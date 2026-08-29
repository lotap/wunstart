import {createInsertSchema, createSelectSchema} from 'drizzle-orm/effect-schema'
import {Effect, Schema, Struct} from 'effect'

import type {RefinementsFor} from '#/db/helpers/types.ts'
import {IpAddress, PGVerboseInterval, UUID, withNullDefault} from '#/db/helpers/validators.ts'

import {PENALTY_INTERVAL_INITIAL} from './consts.ts'
import {activeTable} from './schemas.ts'

/// PRIMITIVES ///

const overrides = {
	ipAddress: Schema.optional(Schema.NullishOr(IpAddress)),
} satisfies RefinementsFor<typeof activeTable>

const insertPrimitive = createInsertSchema(activeTable, overrides)

const selectPrimitive = createSelectSchema(activeTable, overrides)

const PenaltyInterval = Schema.optional(PGVerboseInterval).pipe(
	Schema.withDecodingDefault(Effect.succeed(PENALTY_INTERVAL_INITIAL)),
)

/// INSERT ///

const insertBaseVariant = insertPrimitive
	.mapFields(Struct.omit(['id', 'createdAt', 'expiresAt', 'updatedAt']))
	.mapFields(
		Struct.evolve({
			activitiesArchiveIds: (field) =>
				Schema.mutable(field).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
			activityIds: (field) =>
				Schema.mutable(field).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
			anonId: (field) => field.pipe(withNullDefault),
			anonsArchiveId: (field) => field.pipe(withNullDefault),
			failedCredential: (field) => field.pipe(withNullDefault),
			ipAddress: (field) => field.pipe(withNullDefault),
			userId: (field) => field.pipe(withNullDefault),
			usersArchiveId: (field) => field.pipe(withNullDefault),
			totalWeight: (field) => field.pipe(Schema.withDecodingDefault(Effect.succeed(BigInt(0)))),
		}),
	)
	.mapFields(Struct.assign({penaltyInterval: PenaltyInterval}))

export const Insert = Schema.Union([
	insertBaseVariant.mapFields(
		Struct.evolve({
			scope: () => Schema.Literal('ANON'),
			anonId: () => UUID,
		}),
	),
	insertBaseVariant.mapFields(
		Struct.evolve({
			scope: () => Schema.Literal('ARCHIVED_ANON'),
			anonsArchiveId: () => Schema.BigInt,
		}),
	),
	insertBaseVariant.mapFields(
		Struct.evolve({
			scope: () => Schema.Literal('FAILED_CREDENTIAL'),
			failedCredential: () => Schema.String.check(Schema.isMaxLength(255)),
		}),
	),
	insertBaseVariant.mapFields(
		Struct.evolve({
			scope: () => Schema.Literal('IP_ADDRESS'),
			ipAddress: () => IpAddress,
		}),
	),
	insertBaseVariant.mapFields(
		Struct.evolve({
			scope: () => Schema.Literal('USER'),
			userId: () => UUID,
		}),
	),
	insertBaseVariant.mapFields(
		Struct.evolve({
			scope: () => Schema.Literal('ARCHIVED_USER'),
			usersArchiveId: () => Schema.BigInt,
		}),
	),
])

export const InsertMany = Schema.Array(Insert)

/// SELECT ///

export const Select = selectPrimitive.mapFields(Struct.pick(['id']))

/// UPDATE ///

export const ExtendMany = Schema.Struct({
	ids: Schema.Array(UUID),
	activityId: UUID,
	weightDelta: Schema.BigInt,
}).check(
	Schema.makeFilter(({ids}) => ids.length > 0, {
		message: 'ExtendBans: ids must not be empty',
	}),
)

import {createInsertSchema, createSelectSchema} from 'drizzle-orm/effect-schema'
import {Struct} from 'effect'

import type {RefinementsFor} from '#/db/helpers/types.ts'
import {Argon2Hash, DateFromDateTimeUtc, IpAddress, IpAddresses} from '#/db/helpers/validators.ts'

import {activeTable} from './schemas.ts'

/// PRIMITIVES ///

const overrides = {
	nonceHash: Argon2Hash,
	ipAddresses: IpAddresses,
	expiresAt: DateFromDateTimeUtc,
	graceExpiresAt: DateFromDateTimeUtc,
} satisfies RefinementsFor<typeof activeTable>

const insertPrimitive = createInsertSchema(activeTable, overrides)

const selectPrimitive = createSelectSchema(activeTable, overrides)

/// INSERT ///

export const Insert = insertPrimitive
	.mapFields(Struct.pick(['nonceHash', 'userId']))
	.mapFields(Struct.assign({ipAddress: IpAddress}))

/// SELECT ///

export const Select = selectPrimitive.mapFields(Struct.pick(['id']))

export const ByUser = selectPrimitive.mapFields(Struct.pick(['userId']))

/// UPDATE ///

/**
 * Compare-and-swap refresh rotation.
 * The predicate (expected hash + generation + revocation + expiry) is matched in SQL,
 * so a concurrent rotation makes the update match zero rows instead of last-writer-wins.
 */
export const Rotate = selectPrimitive
	.mapFields(Struct.pick(['id', 'refreshGeneration', 'expiresAt', 'graceExpiresAt', 'graceToken']))
	.mapFields(
		Struct.assign({
			currentNonceHash: Argon2Hash,
			nextNonceHash: Argon2Hash,
			ipAddress: IpAddress,
		}),
	)

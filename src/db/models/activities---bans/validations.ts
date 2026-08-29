import {createSelectSchema} from 'drizzle-orm/effect-schema'
import {Schema, Struct} from 'effect'

import type {RefinementsFor} from '#/db/helpers/types.ts'
import {IpAddress, UUID, withNullDefault} from '#/db/helpers/validators.ts'
import {activeTable as activities} from '#/db/models/activities/schemas.ts'

import {banScopes} from './schemas.ts'

/// PRIMITIVES ///

const banScopesSelectPrimitive = createSelectSchema(banScopes)

export type BanScope = (typeof banScopesSelectPrimitive)['Type']

const activitiesOverrides = {
	ipAddress: IpAddress,
} satisfies RefinementsFor<typeof activities>

const activitiesSelectPrimitive = createSelectSchema(activities, activitiesOverrides)

/// SELECT ///

export const ByManyTargets = activitiesSelectPrimitive
	.mapFields(
		Struct.pick([
			'anonId',
			'anonsArchiveId',
			'failedCredential',
			'ipAddress',
			'userId',
			'usersArchiveId',
		]),
	)
	.mapFields(
		Struct.evolve({
			anonId: (field) => field.pipe(withNullDefault),
			anonsArchiveId: (field) => field.pipe(withNullDefault),
			failedCredential: (field) => field.pipe(withNullDefault),
			ipAddress: (field) => field.pipe(withNullDefault),
			userId: (field) => field.pipe(withNullDefault),
			usersArchiveId: (field) => field.pipe(withNullDefault),
		}),
	)
	.check(
		Schema.makeFilter((val) => Object.values(val).some((v) => v !== null), {
			message: 'ByTargets: at least one field must be non-null',
		}),
	)

export const BySingleTarget = ByManyTargets.check(
	Schema.makeFilter((val) => Object.values(val).filter((v) => v !== null).length === 1, {
		message: 'BySingleTarget: exactly one field must be non-null',
	}),
)

/// UPDATE ///

export const UpdateBansForArchivedActivities = Schema.Struct({
	activityIds: Schema.Array(UUID),
	archiveIds: Schema.Array(Schema.BigInt),
}).check(
	Schema.makeFilter(({activityIds, archiveIds}) => activityIds.length === archiveIds.length, {
		message: 'UpdateBansForArchivedActivities: activityIds and archiveIds must be index-aligned',
	}),
)

import {eq} from 'drizzle-orm'
import {Effect} from 'effect'

import {createArchiveFn} from '#/db/helpers/funcs.ts'
import {
	activeTable as activities,
	archiveTable as activitiesArchive,
} from '#/db/models/activities/schemas.ts'
import {activeTable as bans, archiveTable as bansArchive} from '#/db/models/bans/schemas.ts'
import * as emailVerificationsCascades from '#/db/models/email-verifications/cascades.ts'
import {archiveTable as emailVerificationsArchive} from '#/db/models/email-verifications/schemas.ts'

import * as queries from './queries.ts'
import {activeTable, archiveTable} from './schemas.ts'
import {archiveInsertPrimitive} from './validations.ts'

/** Adds given id to the anonsArchive, handles related cascades, and removes it from anons */
export const archive = createArchiveFn({
	archiveValidation: archiveInsertPrimitive,
	selectFn: queries.select,
	activeTable,
	archiveTable,
	cascades: (tx, id, [archiveId]) => [
		tx
			.update(activities)
			.set({anonsArchiveId: archiveId, anonId: null})
			.where(eq(activities.anonId, id)),

		tx
			.update(activitiesArchive)
			.set({anonsArchiveId: archiveId, anonId: null})
			.where(eq(activitiesArchive.anonId, id)),

		tx.update(bans).set({anonsArchiveId: archiveId, anonId: null}).where(eq(bans.anonId, id)),

		tx
			.update(bansArchive)
			.set({anonsArchiveId: archiveId, anonId: null})
			.where(eq(bansArchive.anonId, id)),

		tx
			.update(emailVerificationsArchive)
			.set({anonsArchiveId: archiveId, anonId: null})
			.where(eq(emailVerificationsArchive.anonId, id)),

		emailVerificationsCascades
			.archiveByAnon({anonId: id}, {tx: tx, extraData: {anonId: null, anonsArchiveId: archiveId}})
			.pipe(
				// No rows is expected (the anon's verification may already have been burned at sign-up)
				Effect.catchTags({
					ArchiveNotFoundError: () => Effect.void,
					ArchiveCountMismatchError: () => Effect.void,
				}),
			),
	],
})

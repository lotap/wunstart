import {eq} from 'drizzle-orm'
import {Effect} from 'effect'

import {createArchiveFn} from '#/db/helpers/funcs.ts'
import {
	activeTable as activities,
	archiveTable as activitiesArchive,
} from '#/db/models/activities/schemas.ts'
import {archiveTable as anonsArchive} from '#/db/models/anons/schemas.ts'
import {activeTable as bans, archiveTable as bansArchive} from '#/db/models/bans/schemas.ts'
import * as emailVerificationsCascades from '#/db/models/email-verifications/cascades.ts'
import {archiveTable as emailVerificationsArchive} from '#/db/models/email-verifications/schemas.ts'
import * as sessionsCascades from '#/db/models/sessions/cascades.ts'
import {archiveTable as sessionsArchive} from '#/db/models/sessions/schemas.ts'

import * as queries from './queries.ts'
import {activeTable, archiveTable} from './schemas.ts'

/** Adds given id to the usersArchive, handles related cascades, and removes it from users */
export const archive = createArchiveFn({
	selectFn: queries.select,
	activeTable,
	archiveTable,
	cascades: (tx, id, [archiveId]) => {
		return [
			tx
				.update(activities)
				.set({usersArchiveId: archiveId, userId: null})
				.where(eq(activities.userId, id)),

			tx.update(bans).set({usersArchiveId: archiveId, userId: null}).where(eq(bans.userId, id)),

			// A count mismatch from a session/verification archive (concurrent write)
			// aborts the whole deletion. Never archive fewer rows than were selected.
			// Zero matching rows is an expected state and continues
			sessionsCascades
				.archiveByUser({userId: id}, {tx, extraData: {usersArchiveId: archiveId}})
				.pipe(
					// A user without any session has nothing to cascade, which is an
					// expected state, not an error; aborting here would roll back the whole deletion
					Effect.catchTag('ArchiveNotFoundError', () => Effect.void),
				),

			emailVerificationsCascades
				.archiveByUser({userId: id}, {tx, extraData: {usersArchiveId: archiveId}})
				.pipe(
					// Likewise for pending email verifications
					Effect.catchTag('ArchiveNotFoundError', () => Effect.void),
				),

			// The archived twins still reference users.id (rows may have been
			// written before their user's deletion or by the child archivals
			// above). Runs last so it sweeps everything, and pairs each row's
			// userId with usersArchiveId to preserve attribution
			tx
				.update(activitiesArchive)
				.set({usersArchiveId: archiveId, userId: null})
				.where(eq(activitiesArchive.userId, id)),

			tx
				.update(bansArchive)
				.set({usersArchiveId: archiveId, userId: null})
				.where(eq(bansArchive.userId, id)),

			tx
				.update(anonsArchive)
				.set({usersArchiveId: archiveId, userId: null})
				.where(eq(anonsArchive.userId, id)),

			tx
				.update(sessionsArchive)
				.set({usersArchiveId: archiveId, userId: null})
				.where(eq(sessionsArchive.userId, id)),

			tx
				.update(emailVerificationsArchive)
				.set({usersArchiveId: archiveId, userId: null})
				.where(eq(emailVerificationsArchive.userId, id)),
		]
	},
})

import {createArchiveFn} from '#/db/helpers/funcs.ts'

import * as queries from './queries.ts'
import {activeTable, archiveTable} from './schemas.ts'

/** Adds given id to the sessionsArchive, handles related cascades, and removes it from sessions */
export const archive = createArchiveFn({
	selectFn: queries.select,
	activeTable,
	archiveTable,
})

/** Adds sessions associated with a user to the sessionsArchive, handles related cascades, and removes it from sessions */
export const archiveByUser = createArchiveFn({
	selectFn: queries.selectByUser,
	selectBy: 'userId',
	activeTable,
	archiveTable,
})

import {createArchiveFn} from '#/db/helpers/funcs.ts'

import * as queries from './queries.ts'
import {activeTable, archiveTable} from './schemas.ts'

/** Adds given id to the activitiesArchive, handles related cascades, and removes it from activities */
export const archive = createArchiveFn({
	selectFn: queries.select,
	activeTable,
	archiveTable,
})

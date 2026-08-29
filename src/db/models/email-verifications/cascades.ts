import {and, eq} from 'drizzle-orm'

import {createArchiveFn} from '#/db/helpers/funcs.ts'

import * as queries from './queries.ts'
import {activeTable, archiveTable} from './schemas.ts'

/**
 * Archives the verification row for the given id if it still holds the
 * passcodeHash the caller read.
 *
 * A concurrent new-code reset changes the hash, so the guarded
 * select+delete find nothing and the freshly reset row is never clobbered
 */
export const archiveWithPasscode = createArchiveFn({
	selectFn: queries.selectWithPasscode,
	activeTable,
	archiveTable,
	deleteWhere: ({passcodeHash}) => and(eq(activeTable.passcodeHash, passcodeHash)),
})

export const archiveByAnon = createArchiveFn({
	selectFn: queries.selectByAnon,
	selectBy: 'anonId',
	activeTable,
	archiveTable,
})

export const archiveByUser = createArchiveFn({
	selectFn: queries.selectByUser,
	selectBy: 'userId',
	activeTable,
	archiveTable,
})

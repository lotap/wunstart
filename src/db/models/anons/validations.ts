import {createInsertSchema, createSelectSchema} from 'drizzle-orm/effect-schema'
import {Struct} from 'effect'

import type {RefinementsFor} from '#/db/helpers/types.ts'
import {DateFromDateTimeUtc, IpAddresses} from '#/db/helpers/validators.ts'

import {activeTable, archiveTable} from './schemas.ts'

/// PRIMITIVES ///

const overrides = {
	ipAddresses: IpAddresses,
	tokenCreatedAt: DateFromDateTimeUtc,
} satisfies RefinementsFor<typeof activeTable>

const insertPrimitive = createInsertSchema(activeTable, overrides)

const selectPrimitive = createSelectSchema(activeTable, overrides)

/// INSERT ///

export const Insert = insertPrimitive.mapFields(
	Struct.pick(['id', 'tokenCreatedAt', 'ipAddresses']),
)

/// SELECT ///

export const Select = selectPrimitive.mapFields(Struct.pick(['id']))

/// ARCHIVE ///

/// PRIMITIVES ///

const archiveOverrides = {
	ipAddresses: IpAddresses,
	tokenCreatedAt: DateFromDateTimeUtc,
} satisfies RefinementsFor<typeof archiveTable>

export const archiveInsertPrimitive = createInsertSchema(archiveTable, archiveOverrides)

/// INSERT ///

export const ArchiveInsert = archiveInsertPrimitive.mapFields(
	Struct.pick(['id', 'tokenCreatedAt', 'ipAddresses']),
)

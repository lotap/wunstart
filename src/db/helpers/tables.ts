import {sql} from 'drizzle-orm'
import {
	bigint,
	snakeCase,
	timestamp,
	uuid,
	type AnyPgColumnBuilder,
	type PgBuildExtraConfigColumns,
	type PgTableExtraConfigValue,
} from 'drizzle-orm/pg-core'

import {TIMESTAMPTZ_CONFIG} from './consts.ts'

type Columns<T> = {[K in keyof T]: AnyPgColumnBuilder}

type Xtra<T extends Columns<T>> = (self: PgBuildExtraConfigColumns<T>) => PgTableExtraConfigValue[]

/// ACTIVE ///

const activeDefaultCols = {
	id: uuid().primaryKey().defaultRandom(),
	createdAt: timestamp(TIMESTAMPTZ_CONFIG).notNull().defaultNow(),
	updatedAt: timestamp(TIMESTAMPTZ_CONFIG)
		.notNull()
		.defaultNow()
		.$onUpdate(() => sql`now()`),
}

type ActiveMergedCols<T> = Omit<typeof activeDefaultCols, keyof T> & T

export function createActiveTable<T extends Columns<T>>(
	name: string,
	// SAFETY: omitted columns means the table adds no columns beyond the defaults,
	// so the empty column set is the valid base case for the merged type.
	columns: T = {} as T,
	extraConfig?: Xtra<ActiveMergedCols<T>>,
) {
	return snakeCase.table<typeof name, ActiveMergedCols<T>>(
		name,
		{...activeDefaultCols, ...columns},
		extraConfig,
	)
}

/// ARCHIVE ///

const archiveDefaultCols = {
	id: uuid().notNull(),
	createdAt: timestamp(TIMESTAMPTZ_CONFIG).notNull(),
	updatedAt: timestamp(TIMESTAMPTZ_CONFIG).notNull(),
	archiveId: bigint('archive_id', {mode: 'bigint'}).primaryKey().generatedByDefaultAsIdentity(),
	archivedAt: timestamp(TIMESTAMPTZ_CONFIG).notNull().defaultNow(),
}

type ArchiveMergedCols<T> = Omit<typeof archiveDefaultCols, keyof T> & T

export function createArchiveTable<T extends Columns<T>>(
	name: string,
	// SAFETY: omitted columns means the table adds no columns beyond the defaults,
	// so the empty column set is the valid base case for the merged type.
	columns: T = {} as T,
	extraConfig?: Xtra<ArchiveMergedCols<T>>,
) {
	return snakeCase.table<typeof name, ArchiveMergedCols<T>>(
		name,
		{...archiveDefaultCols, ...columns},
		extraConfig,
	)
}

/// ACTIVE LOG ///

const activeLogDefaultCols = {
	id: uuid().primaryKey().defaultRandom(),
	timestamp: timestamp(TIMESTAMPTZ_CONFIG).notNull().defaultNow(),
}

type ActiveLogMergedCols<T> = Omit<typeof activeLogDefaultCols, keyof T> & T

export function createActiveLogTable<T extends Columns<T>>(
	name: string,
	// SAFETY: omitted columns means the table adds no columns beyond the defaults,
	// so the empty column set is the valid base case for the merged type.
	columns: T = {} as T,
	extraConfig?: Xtra<ActiveLogMergedCols<T>>,
) {
	return snakeCase.table<typeof name, ActiveLogMergedCols<T>>(
		name,
		{...activeLogDefaultCols, ...columns},
		extraConfig,
	)
}

/// ARCHIVE LOG ///

const archiveLogDefaultCols = {
	id: uuid().notNull(),
	timestamp: timestamp(TIMESTAMPTZ_CONFIG).notNull(),
	archiveId: bigint('archive_id', {mode: 'bigint'}).primaryKey().generatedByDefaultAsIdentity(),
	archivedAt: timestamp(TIMESTAMPTZ_CONFIG).notNull().defaultNow(),
}

type ArchiveLogMergedCols<T> = Omit<typeof archiveLogDefaultCols, keyof T> & T

export function createArchiveLogTable<T extends Columns<T>>(
	name: string,
	// SAFETY: omitted columns means the table adds no columns beyond the defaults,
	// so the empty column set is the valid base case for the merged type.
	columns: T = {} as T,
	extraConfig?: Xtra<ArchiveLogMergedCols<T>>,
) {
	return snakeCase.table<typeof name, ArchiveLogMergedCols<T>>(
		name,
		{...archiveLogDefaultCols, ...columns},
		extraConfig,
	)
}

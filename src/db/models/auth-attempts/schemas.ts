import {
	index,
	integer,
	pgEnum,
	primaryKey,
	snakeCase,
	timestamp,
	varchar,
} from 'drizzle-orm/pg-core'

import {TIMESTAMPTZ_CONFIG} from '#/db/helpers/column-config.ts'

export const tableName = 'auth_attempts'

/**
 * What an auth attempt row's target identifies: the client network or the credential the
 * presentation claimed. A closed set by construction — a new dimension is a new
 * keying decision, not a value to append
 */
export const attemptScopes = pgEnum('attempt_scopes', ['CREDENTIAL', 'NETWORK'])

/**
 * Rolling auth attempt rows, upserted before any hashing.
 *
 * The row is the whole state: a caller-declared composite key and a mutable
 * count, so there is no surrogate `id`, no lifecycle timestamps, and no archive
 * twin. Rows are replaced lazily by the window and swept by the daily cron, so
 * a delete path would have nothing to audit.
 */
export const activeTable = snakeCase.table(
	tableName,
	{
		scope: attemptScopes().notNull(),
		/**
		 * The network CIDR, or the email the presentation claimed — lowercased by the
		 * email validator on decode, since the column has no such constraint
		 */
		target: varchar({length: 255}).notNull(),
		windowStart: timestamp(TIMESTAMPTZ_CONFIG).notNull().defaultNow(),
		count: integer().notNull().default(0),
	},
	(t) => [
		primaryKey({columns: [t.scope, t.target]}),
		/** The sweep's only predicate */
		index().on(t.windowStart),
	],
)

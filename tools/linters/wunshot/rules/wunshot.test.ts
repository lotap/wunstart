import {RuleTester} from 'oxlint/plugins-dev'

import {noCatchArchiveCountMismatchInTxRule} from './no-catch-archive-count-mismatch-in-tx.ts'
import {noFailedCredentialInDenialRule} from './no-failed-credential-in-denial.ts'
import {noPgTableDirectRule} from './no-pgtable-direct.ts'
import {noReexportRule} from './no-reexport.ts'
import {noZodValibotRule} from './no-zod-valibot.ts'

const tester = new RuleTester({languageOptions: {parserOptions: {lang: 'ts'}}})

tester.run('wunshot/no-pgtable-direct', noPgTableDirectRule, {
	valid: [
		"import {snakeCase} from 'drizzle-orm/pg-core';",
		"import {createActiveTable} from '#/db/helpers/table-fns.ts';",
		"export {snakeCase} from 'drizzle-orm/pg-core';",
		// Bare dynamic import is not use (legitimate members load this way); calls still flag.
		"const pg = await import('drizzle-orm/pg-core');",
		// An unrelated helper's own `.pgTable()` method is not drizzle's.
		'const t = other.pgTable("users", {});',
		"import * as helper from 'other-lib'; const t = helper.pgTable('users', {});",
		'const t = (await import("other-lib")).pgTable("users", {});',
	],
	invalid: [
		{
			code: "import {pgTable} from 'drizzle-orm/pg-core';",
			errors: [{messageId: 'pgTableDirect'}],
		},
		{
			code: 'const t = pgTable("users", {});',
			errors: [{messageId: 'pgTableDirect'}],
		},
		{
			code: 'import * as dor from \'drizzle-orm/pg-core\'; const t = dor.pgTable("users", {});',
			errors: [{messageId: 'pgTableDirect'}],
		},
		{
			code: 'const pg = await import(\'drizzle-orm/pg-core\'); const t = pg.pgTable("users", {});',
			errors: [{messageId: 'pgTableDirect'}],
		},
		{
			code: 'const t = (await import("drizzle-orm/pg-core")).pgTable("users", {});',
			errors: [{messageId: 'pgTableDirect'}],
		},
		{
			code: "export {pgTable} from 'drizzle-orm/pg-core';",
			errors: [{messageId: 'pgTableDirect'}],
		},
		{
			code: "export * from 'drizzle-orm/pg-core';",
			errors: [{messageId: 'pgTableDirect'}],
		},
	],
})

tester.run('wunshot/no-zod-valibot', noZodValibotRule, {
	valid: [
		"import {Schema} from 'effect';",
		"import {createInsertSchema} from 'drizzle-orm/effect-schema';",
	],
	invalid: [
		{
			code: "import {z} from 'zod';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "import * as v from 'valibot';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "import {z} from 'zod/v4';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "import {z} from 'drizzle-zod';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "import {createInsertSchema} from 'drizzle-valibot';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "import {getTableColumns} from 'drizzle-orm/zod';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "import {getTableColumns} from 'drizzle-orm/valibot/schema';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "export {z} from 'zod';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "export * from 'valibot';",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "const z = await import('zod');",
			errors: [{messageId: 'zodValibot'}],
		},
		{
			code: "import {email} from 'valibot/v1';",
			errors: [{messageId: 'zodValibot'}],
		},
	],
})

tester.run('wunshot/no-failed-credential-in-denial', noFailedCredentialInDenialRule, {
	valid: [
		'rateLimitFailure({rateAllowance: 1, meta: {credential: email}});',
		'otherFailure({failedCredential: email});',
	],
	invalid: [
		{
			code: 'rateLimitFailure({rateAllowance: 1, failedCredential: email});',
			errors: [{messageId: 'failedCredential'}],
		},
		{
			code: 'rateLimitFailure({rateAllowance: 1, failedCredential});',
			errors: [{messageId: 'failedCredential'}],
		},
		{
			code: "rateLimitFailure({rateAllowance: 1, 'failedCredential': email});",
			errors: [{messageId: 'failedCredential'}],
		},
	],
})

tester.run('wunshot/no-catch-archive-count-mismatch-in-tx', noCatchArchiveCountMismatchInTxRule, {
	valid: [
		// No transaction: the archive call owns it, so catching the mismatch commits nothing.
		"childArchive({id}, {}).pipe(Effect.catchTag('ArchiveCountMismatchError', () => Effect.void));",
		"db.transaction((tx) => childArchive({id}, {tx}).pipe(Effect.catchTag('ArchiveNotFoundError', () => Effect.void)));",
		'db.transaction((tx) => childArchive({id}, {tx}).pipe(Effect.catchTags({ArchiveNotFoundError: () => Effect.void})));',
		// A transaction bound under another name is outside the rule's recognition (review backstop).
		"db.transaction((transaction) => childArchive({id}, {transaction}).pipe(Effect.catchTag('ArchiveCountMismatchError', () => Effect.void)));",
		// An options object without a transaction binding is not a transaction body.
		"const run = ({input}) => childArchive(input, {}).pipe(Effect.catchTag('ArchiveCountMismatchError', () => Effect.void));",
	],
	invalid: [
		{
			code: "cascades: (tx, id) => [childArchive({id}, {tx}).pipe(Effect.catchTag('ArchiveCountMismatchError', () => Effect.void))]",
			errors: [{messageId: 'archiveMismatchInTx'}],
		},
		{
			code: 'db.transaction((tx) => Effect.gen(function* () { yield* childArchive({}, {tx}).pipe(Effect.catchTags({ArchiveNotFoundError: () => Effect.void, ArchiveCountMismatchError: () => Effect.void})) }))',
			errors: [{messageId: 'archiveMismatchInTx'}],
		},
		{
			code: "const run = function (_tx) { return Effect.catchTag('ArchiveCountMismatchError', () => Effect.void) }",
			errors: [{messageId: 'archiveMismatchInTx'}],
		},
		{
			code: "const run = (tx) => () => Effect.catchTags({'ArchiveCountMismatchError': () => Effect.void})",
			errors: [{messageId: 'archiveMismatchInTx'}],
		},
		{
			// The archive machinery takes the caller's transaction in its options bag.
			code: "const archiveFn = Effect.fn(function* (input, {tx} = {}) { yield* childArchive(input, {tx}).pipe(Effect.catchTag('ArchiveCountMismatchError', () => Effect.void)) })",
			errors: [{messageId: 'archiveMismatchInTx'}],
		},
		{
			code: 'const archiveFn = (input, {tx: transaction}) => childArchive(input, {transaction}).pipe(Effect.catchTags({ArchiveCountMismatchError: () => Effect.void}))',
			errors: [{messageId: 'archiveMismatchInTx'}],
		},
	],
})

tester.run('wunshot/no-reexport', noReexportRule, {
	valid: [
		'export const value = 1;',
		'export function run() {}',
		'export type Shape = {readonly id: string};',
		"import {value} from './value.ts'; export const doubled = value * 2;",
		"import {value} from './value.ts'; const local = value; export {local};",
		'const local = 1; export {local};',
		'export default function run() {}',
		'export default class Run {}',
	],
	invalid: [
		{
			code: "import {value} from './value.ts'; export {value};",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "import type {Shape} from './shape.ts'; export type {Shape};",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "export {value} from './value.ts';",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "export type {Shape} from './shape.ts';",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "export * from './value.ts';",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "export * as values from './value.ts';",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "import value from './value.ts'; export default value;",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "import * as values from './value.ts'; export {values};",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "export {value}; import {value} from './value.ts';",
			errors: [{messageId: 'forwardingReexport'}],
		},
		{
			code: "import {value} from './value.ts'; export {value as renamed};",
			errors: [{messageId: 'forwardingReexport'}],
		},
	],
})

import {RuleTester} from 'oxlint/plugins-dev'

import {noFailedCredentialInDenialRule} from './no-failed-credential-in-denial.ts'
import {noPgTableDirectRule} from './no-pgtable-direct.ts'
import {noZodValibotRule} from './no-zod-valibot.ts'

const tester = new RuleTester({languageOptions: {parserOptions: {lang: 'ts'}}})

tester.run('wunshot/no-pgtable-direct', noPgTableDirectRule, {
	valid: [
		"import {snakeCase} from 'drizzle-orm/pg-core';",
		"import {createActiveTable} from '#/db/helpers/tables.ts';",
		"export {snakeCase} from 'drizzle-orm/pg-core';",
		// Bare dynamic import is not use (legitimate members load this way); calls still flag.
		"const pg = await import('drizzle-orm/pg-core');",
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
			code: 'const t = dor.pgTable("users", {});',
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

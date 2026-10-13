import {RuleTester} from 'oxlint/plugins-dev'

import {emailLayerAllowlistRule} from './email-layer-allowlist.ts'
import {noSingleSessionRevokeRule} from './no-single-session-revoke.ts'
import {noStaticWorkersImportInMiddlewareRule} from './no-static-workers-import-in-middleware.ts'

const tester = new RuleTester({languageOptions: {parserOptions: {lang: 'ts'}}})

tester.run(
	'wunstart/no-static-workers-import-in-middleware',
	noStaticWorkersImportInMiddlewareRule,
	{
		valid: [
			{
				code: "import type {Env} from 'cloudflare:workers';",
				filename: 'src/middleware/verify-auth.ts',
			},
			{
				code: "import {env} from 'cloudflare:workers';",
				filename: 'src/server-fns/handle-sign-in.ts',
			},
			{
				code: "import {dbLayer} from '#/db/index.ts';",
				filename: 'src/middleware/verify-auth.ts',
			},
			{
				code: "import {signAnon} from '#/db/ops/auth/sign-anon.ts';",
				filename: 'src/middleware/verify-anon.ts',
			},
			{
				code: "import type {verifyAccess as verifyAccessOpType} from '#/db/ops/auth/verify-access';",
				filename: 'src/middleware/verify-auth.ts',
			},
		{
			code: "import {type verifyAccess} from '#/db/ops/auth/verify-access';",
			filename: 'src/middleware/verify-auth.ts',
		},
		{
			code: "import {x} from '#/lib/refresh.ts';",
			filename: 'src/middleware/verify-auth.ts',
		},
		{
			code: "export type {x} from '#/db/ops/auth/refresh';",
			filename: 'src/middleware/verify-auth.ts',
		},
		],
		invalid: [
			{
				code: "import {env} from 'cloudflare:workers';",
				filename: 'src/middleware/verify-auth.ts',
				errors: [{messageId: 'staticWorkersImport'}],
			},
			{
				code: "import {refresh} from '#/db/ops/auth/refresh';",
				filename: 'src/middleware/verify-auth.ts',
				errors: [{messageId: 'staticWorkersImport'}],
			},
			{
				code: "import {verifyAccess} from '#/db/ops/auth/verify-access';",
				filename: 'src/middleware/verify-auth.ts',
				errors: [{messageId: 'staticWorkersImport'}],
			},
		{
			code: "import {verifyAnon} from '#/db/ops/auth/verify-anon.ts';",
			filename: 'src/middleware/verify-anon.ts',
			errors: [{messageId: 'staticWorkersImport'}],
		},
		{
			code: "import refreshDefault from '#/db/ops/auth/refresh.ts';",
			filename: 'src/middleware/verify-auth.ts',
			errors: [{messageId: 'staticWorkersImport'}],
		},
		{
			code: "import * as refreshNs from '#/db/ops/auth/refresh.ts';",
			filename: 'src/middleware/verify-auth.ts',
			errors: [{messageId: 'staticWorkersImport'}],
		},
		{
			code: "export {refresh} from '#/db/ops/auth/refresh';",
			filename: 'src/middleware/verify-auth.ts',
			errors: [{messageId: 'staticWorkersImport'}],
		},
		{
			code: "export * from '#/db/ops/auth/verify-access';",
			filename: 'src/middleware/verify-auth.ts',
			errors: [{messageId: 'staticWorkersImport'}],
		},
		],
	},
)

tester.run('wunstart/no-single-session-revoke', noSingleSessionRevokeRule, {
	valid: [
		'export const signOutAll = createOpsFn({});',
		'export const revokeForReuse = createOpsFn({});',
		'export const revokeAllSessions = createOpsFn({});',
		'export const listSessions = createOpsFn({});',
		'const revokeSession = createOpsFn({});',
		'export const noSingleSessionRevokeRule = defineRule({});',
	],
	invalid: [
		{
			code: 'export const revokeSession = createOpsFn({});',
			errors: [{messageId: 'singleSessionRevoke'}],
		},
		{
			code: 'export function revokeSessionById() {}',
			errors: [{messageId: 'singleSessionRevoke'}],
		},
		{
			code: 'const revokeSession = createOpsFn({}); export {revokeSession};',
			errors: [{messageId: 'singleSessionRevoke'}],
		},
		{
			code: 'const x = createOpsFn({}); export {x as revokeSession};',
			errors: [{messageId: 'singleSessionRevoke'}],
		},
		{
			code: 'export default function revokeSession() {}',
			errors: [{messageId: 'singleSessionRevoke'}],
		},
	],
})

tester.run('wunstart/email-layer-allowlist', emailLayerAllowlistRule, {
	valid: [
		{
			code: "import {emailLayer} from '#/email/layer.ts';",
			filename: 'src/server-fns/handle-email-request-passcode.ts',
		},
		{
			code: "import {emailLayer} from '#/email/layer.ts';",
			filename: 'src/middleware/verify-auth.ts',
		},
		{
			code: "import {renderSignInNotification} from '#/email/templates/sign-in-notification.tsx';",
			filename: 'src/db/ops/auth/password-sign-in.ts',
		},
		{
			code: "export type {x} from '#/email/layer.ts';",
			filename: 'src/routes/settings.tsx',
		},
		{
			code: "import {x} from '#/server-fns/handle-email-request-passcode.ts';",
			filename: 'src/routes/settings.tsx',
		},
		{
			code: "import {x} from '#/lib/nicamail/x.ts';",
			filename: 'src/routes/settings.tsx',
		},
	],
	invalid: [
		{
			code: "import {emailLayer} from '#/email/layer.ts';",
			filename: 'src/routes/settings.tsx',
			errors: [{messageId: 'emailLayerOutsideAllowlist'}],
		},
		{
			code: "import {renderVerifyEmail} from '#/email/templates/verify-email.tsx';",
			filename: 'src/routes/sign-up.tsx',
			errors: [{messageId: 'emailLayerOutsideAllowlist'}],
		},
		{
			code: "import {x} from '../../email/layer.ts';",
			filename: 'src/routes/settings.tsx',
			errors: [{messageId: 'emailLayerOutsideAllowlist'}],
		},
		{
			code: "export {x} from '#/email/layer.ts';",
			filename: 'src/routes/settings.tsx',
			errors: [{messageId: 'emailLayerOutsideAllowlist'}],
		},
		{
			code: "export * from '#/email/templates/verify-email.tsx';",
			filename: 'src/routes/sign-up.tsx',
			errors: [{messageId: 'emailLayerOutsideAllowlist'}],
		},
		{
			code: "const m = await import('#/email/layer.ts');",
			filename: 'src/routes/settings.tsx',
			errors: [{messageId: 'emailLayerOutsideAllowlist'}],
		},
	],
})

import {ImageOptimizationFeature} from '../-components/feature-explorer/features/image-optimization-feature.tsx'
/**
 * Transitional feature registry. Auth, Abuse Protection, and planned entries
 * are still data-driven. New features are components: add a `Panel` entry here
 * and put the content in `feature-explorer/features/`. Target: this file
 * becomes the ordered feature list or disappears.
 */
import {
	guardrailsChart,
	passwordChangeChart,
	passwordSignInChart,
	refreshChart,
	requestPasscodeChart,
	signOutChart,
	verifyAccessChart,
	verifyPasscodeChart,
} from './auth-charts.ts'
import type {Feature} from './types.ts'

export const features: Feature[] = [
	{
		key: 'auth',
		name: 'Auth',
		status: 'working',
		summary:
			'Create an account, verify your email, and sign in. Manage sessions and credentials in Settings.',
		actions: [
			{
				label: 'Create account',
				description: 'Verify an email with a six-digit passcode.',
				href: '/sign-up',
			},
			{label: 'Sign in', description: 'Use your email and password.', href: '/sign-in'},
			{
				label: 'Settings',
				description: 'Change email or password, review sessions, or remove your account.',
				href: '/settings',
			},
		],
		flows: [
			{
				key: 'create-account',
				name: 'Create account',
				routes: ['/sign-up'],
				serverFunctions: ['handleEmailRequestPasscode', 'handleEmailVerifyPasscode'],
				ops: ['registerAnon', 'emailRequestPasscode', 'emailVerifyPasscode'],
				models: [
					'anons',
					'anons_archive',
					'email_verifications',
					'email_verifications_archive',
					'users',
					'sessions',
					'activities',
					'activities_archive',
					'bans',
					'bans_archive',
				],
				charts: [
					{label: 'Request code', source: requestPasscodeChart('/sign-up')},
					{label: 'Verify code', source: verifyPasscodeChart('/sign-up')},
				],
				notes: [
					'Checks rate limits and bans before issuing or verifying a code.',
					'New emails create the account and session. Local email lands in Mailpit.',
					'Failed sends archive the verification row immediately. Wrong codes count up to four attempts before the row is archived.',
					'A sign-up race against an existing email falls back to sign-in with the already-verified code.',
				],
				mailpit: true,
			},
			{
				key: 'sign-in',
				name: 'Sign in',
				routes: ['/sign-in'],
				serverFunctions: [
					'handlePasswordSignIn',
					'handleEmailRequestPasscode',
					'handleEmailVerifyPasscode',
				],
				ops: ['passwordSignIn', 'registerAnon', 'emailRequestPasscode', 'emailVerifyPasscode'],
				models: [
					'users',
					'sessions',
					'anons',
					'anons_archive',
					'email_verifications',
					'email_verifications_archive',
					'activities',
					'activities_archive',
					'bans',
					'bans_archive',
				],
				charts: [
					{label: 'Password', source: passwordSignInChart},
					{label: 'Request code', source: requestPasscodeChart('/sign-in')},
					{label: 'Verify code', source: verifyPasscodeChart('/sign-in')},
				],
				notes: [
					'Both branches set auth cookies. Passcode sign-in uses the same request and verify ops as sign-up.',
					'Unknown emails and wrong passwords share one generic error.',
					'A passcode request for an unknown email sends a no-account notice instead of a code.',
				],
			},
			{
				key: 'verify-session',
				name: 'Verify session',
				routes: ['All server function calls'],
				serverFunctions: ['verifyAnon (middleware)', 'verifyAuth (middleware)'],
				ops: ['verifyAccess', 'refresh'],
				models: ['sessions', 'users', 'activities', 'bans'],
				charts: [
					{label: 'Access token', source: verifyAccessChart},
					{label: 'Refresh fallback', source: refreshChart},
				],
				notes: [
					'Valid access tokens are decrypted and checked with no Postgres round trip.',
					'Refresh runs only when the access cookie is missing or invalid. The current generation rotates the session nonce and both token cookies, and records a 30-second grace token on the session for retries.',
					'A one-generation-old refresh token replays through the grace token. Older tokens revoke the session and notify the account owner.',
					'A future-generation refresh token is rejected without revoking the session.',
					'Definitive token failures clear both cookies. Rate-limit rejections keep them and fall through to an Anon. Infrastructure failures surface as a 503.',
				],
			},
			{
				key: 'sign-out',
				name: 'Sign out',
				routes: ['/settings', 'User menu'],
				serverFunctions: ['handleSignOut', 'handleSignOutAll'],
				ops: ['signOut', 'signOutAll'],
				models: ['sessions', 'sessions_archive', 'activities', 'bans'],
				charts: [{source: signOutChart}],
				notes: [
					'Archives sessions, clears auth cookies, and issues a fresh Anon.',
					'Single sign-out verifies the refresh token. Sign out all uses the access token and archives every session.',
				],
			},
			{
				key: 'change-password',
				name: 'Change password',
				routes: ['/settings'],
				serverFunctions: ['handlePasswordReverify', 'handlePasswordChange'],
				ops: ['passwordReverify', 'passwordChange'],
				models: ['users', 'sessions', 'sessions_archive', 'activities', 'bans'],
				charts: [{source: passwordChangeChart}],
				notes: [
					'Requires a fresh sudo verification. Optionally archives every session and sends a confirmation email.',
					'Stale sudo fails before any update; new passwords are strength-checked in the handler.',
				],
			},
		],
		prompt:
			'Add a new sign-in method to the existing auth flow. Ask me which method first. Keep the visitor-to-account signup, session rotation, activity logging, and ban behavior intact. Show me every route, table, and op you touch.',
		notes: [
			'Every server function call resolves identity before its handler: verifyAnon delegates to verifyAuth, then reuses or issues an Anon when the request is anonymous.',
			'Credential requests are protected by rate limits and bans. See Abuse Protection for the guardrail flow.',
			'OAuth sign-in isn’t built yet.',
		],
		references: [
			{
				label: 'OWASP password storage',
				href: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
			},
			{
				label: 'OWASP session management',
				href: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html',
			},
			{label: 'RFC 9106: Argon2', href: 'https://www.rfc-editor.org/rfc/rfc9106'},
		],
	},
	{
		key: 'abuse',
		name: 'Abuse Protection',
		status: 'working',
		summary:
			'Limit abusive requests, ban repeat offenders, and verify humans. CAPTCHA is coming soon.',
		actions: [],
		flows: [
			{
				key: 'guardrails',
				name: 'Guardrails',
				routes: ['All server function calls'],
				serverFunctions: ['rateLimit (middleware)', 'createRateLimit(150) (middleware)'],
				ops: ['createOpsFn', 'checkCurrentBansAndExcessiveActivities', 'logActivityAndHandleBans'],
				models: ['activities', 'bans'],
				charts: [{source: guardrailsChart}],
				notes: [
					'The request limiter is in-memory per IP: 150 requests/min globally, plus 5/min on auth functions. Credential ops check bans first; ops log their outcomes by default, and each logged activity extends or creates bans.',
				],
			},
		],
		prompt:
			'Add CAPTCHA to the existing auth flows. Ask me which provider first. Keep the rate limits, bans, and activity logging intact. Show me every route, middleware, and env var you touch.',
		notes: ['CAPTCHA integration isn’t built yet. Rate limits and bans are active today.'],
		references: [
			{
				label: 'OWASP credential stuffing prevention',
				href: 'https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html',
			},
			{
				label: 'OWASP automated threats',
				href: 'https://owasp.org/www-project-automated-threats-to-web-applications/',
			},
		],
	},
	{
		key: 'rbac',
		name: 'RBAC',
		status: 'planned',
		summary: 'Give people roles and limit what they can do.',
		placeholder: 'No roles page or role tables.',
	},
	{
		key: 'analytics',
		name: 'Analytics',
		status: 'planned',
		summary: 'See how people use the app.',
		placeholder: 'No dashboard or event table.',
	},
	{
		key: 'flags',
		name: 'Feature Flags',
		status: 'planned',
		summary: 'Control a feature without a deploy.',
		placeholder: 'No flag controls or table.',
	},
	{
		key: 'files',
		name: 'File Upload',
		status: 'planned',
		summary: 'Let people upload files to the app.',
		placeholder: 'No upload handling or storage.',
	},
	{
		key: 'images',
		name: 'Image Optimization',
		status: 'working',
		Panel: ImageOptimizationFeature,
	},
	{
		key: 'payments',
		name: 'Payment Processing',
		status: 'planned',
		summary: 'Charge customers and manage plans.',
		placeholder: 'No checkout or billing flow.',
	},
	{
		key: 'agents',
		name: 'Agentic Integrations',
		status: 'planned',
		summary: 'Give agents safe actions to take in your app.',
		placeholder: 'No agent interface or tool registry.',
	},
]

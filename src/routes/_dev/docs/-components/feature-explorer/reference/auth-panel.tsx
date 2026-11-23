/**
 * Policy prose: the table or code owns the details; state the invariant and
 * link. Name the code path behind a behavioral claim.
 * Rules: .agents/skills/wunstart/references/docs.md § Policy prose.
 */
import {ANON_COOKIE_WEEKS} from '#/db/ops/auth/anons/consts.ts'
import {REFRESH_GRACE_SECONDS} from '#/db/ops/auth/sessions/consts.ts'
import {PASSCODE_MAX_ATTEMPTS} from '#/db/ops/auth/strategies/email/consts.ts'
import {ACCESS_TOKEN_EXPIRATION_MILLISECONDS} from '#/db/ops/auth/tokens/consts.ts'

import {PanelLink, PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'
import {FeatureFlows, type FeatureFlow} from '../feature-blocks.tsx'

/** Access token lifetime in minutes for the sessions table. */
const accessTokenMinutes = ACCESS_TOKEN_EXPIRATION_MILLISECONDS / 60_000

const requestPasscodeChart = (formPath: string) => `flowchart LR
  form(["${formPath}"]) -->|"email + intent"| fn["handleEmailRequestPasscode"]
  fn -->|"middleware"| rl["rateLimit · requireAnon"] -->|"runOp"| op["emailRequestPasscode"]
  fn -->|"runOp · if unregistered"| reg["registerAnon"] -->|"insert"| anons[("anons")]
  reg -->|"log"| logs[("activities · bans")]
  reg -.->|"registered anon · Set-Cookie"| cookie[/"anon cookie"/]
  op -->|"pre-check"| logs
  op -->|"anon liveness"| anons
  op -->|"lookup recipient"| users[("users")]
  op -->|"upsert code"| verifications[("email_verifications")]
  op -->|"hash code"| hash{{"AuthHasher DO"}}
  op -->|"send"| mail{{"EmailService"}}
  op -->|"send fails"| failedArchive[("email_verifications_archive")]
  op -->|"log"| logs`

const verifyPasscodeChart = (formPath: string) => `flowchart LR
  form(["${formPath}"]) -->|"email + passcode"| fn["handleEmailVerifyPasscode"]
  fn -->|"rate limit + requireAnonRegistered"| mw["rateLimit · requireAnonRegistered"] -->|"runOp"| op["emailVerifyPasscode"]
  op -->|"pre-check"| logs[("activities · bans")]
  op -->|"lookup / create"| account[("users · sessions")]
  op -->|"verify code"| verifications[("email_verifications")]
  op -->|"verify hash"| hash{{"AuthHasher DO"}}
  op -->|"wrong / expired"| retry["count attempt · archive at max attempts"]
  op -->|"burn code"| archive[("email_verifications_archive")]
  op -->|"create session"| sessions[("sessions")]
  op -->|"retire anon"| anons[("anons · anons_archive")]
  op -->|"nonce hash"| hash
  op -->|"access JWE"| secrets{{"authLayer secrets"}}
  op -->|"notify existing"| mail{{"EmailService"}}
  op -->|"log"| logs
  fn -.->|"Set-Cookie: access + refresh · clear anon"| cookie[/"auth cookies"/]`

const passwordSignInChart = `flowchart LR
  form(["/sign-in"]) -->|"email + password"| fn["handlePasswordSignIn"]
  fn -->|"rate limit + requireAnon"| mw["rateLimit · requireAnon"] -->|"runOp"| op["passwordSignIn"]
  op -->|"pre-check"| logs[("activities · bans")]
  op -->|"lookup / rehash"| account[("users · sessions")]
  op -->|"verify password"| hash{{"AuthHasher DO"}}
  op -->|"nonce hash"| hash
  op -->|"access JWE"| secrets{{"authLayer secrets"}}
  op -->|"create session"| sessions[("sessions")]
  op -->|"retire anon"| anons[("anons · anons_archive")]
  op -->|"notify"| mail{{"EmailService"}}
  op -->|"log"| logs
  fn -.->|"Set-Cookie: access + refresh · clear anon"| cookie[/"auth cookies"/]`

const verifyAccessChart = `flowchart LR
  request(["HTTP request"]) -->|"auth middleware"| verify["verifyAuth"]
  cookie[/"access cookie"/] -->|"JWE"| verify
  verify -->|"runOp"| op["verifyAccess"]
  op -->|"decrypt / validate"| secrets{{"authLayer secrets"}}
  op -->|"userId · sudoExpiresAt"| context["server fn context"]`

const refreshChart = `flowchart LR
  request(["HTTP request"]) -->|"invalid access"| verify["verifyAuth"]
  cookie[/"refresh cookie"/] -->|"JWS"| verify
  verify -->|"runOp"| op["refresh"]
  op -->|"load session"| sessions[("sessions")]
  op -->|"pre-check"| logs[("activities · bans")]
  op -->|"current generation"| rotate["verify nonce · CAS rotate"]
  rotate -->|"AuthHasher DO"| hash{{"AuthHasher DO"}}
  rotate -->|"new access + refresh"| nextCookie[/"access + refresh cookies"/]
  op -->|"one generation behind"| grace["grace replay"] -->|"new tokens"| nextCookie
  op -->|"older / expired grace"| revoke["revoke session"] -->|"notify"| mail{{"EmailService"}}
  op -->|"invalid / future"| clear["verifyAuth clears both cookies"]
  op -->|"log"| logs
  verify -->|"refresh ok"| context["server fn context"]`

const signOutChart = `flowchart LR
  menu(["/settings · user menu"]) -->|"this device"| outFn["handleSignOut"] --> authOut["signOutRateLimit · requireAuth"] -->|"runOp"| outOp["signOut"]
  outOp -->|"refresh JWS"| secrets{{"authLayer secrets"}}
  outOp -->|"verify nonce"| hash{{"AuthHasher DO"}}
  outOp -->|"read"| active[("sessions")]
  outOp -->|"archive"| sessions[("sessions_archive")]
  outOp -->|"log"| logs[("activities · bans")]
  outFn -.->|"refresh in · clear auth · set anon"| cookie[/"Set-Cookie"/]
  menu -->|"all devices"| allFn["handleSignOutAll"] --> authAll["signOutRateLimit · requireAuth"] -->|"runOp"| allOp["signOutAll"]
  allOp -->|"refresh JWS"| secrets
  allOp -->|"live session · nonce · grace"| active
  allOp -->|"verify nonce"| hash
  allOp -->|"archive by user"| sessions
  allOp -->|"log"| logs
  allFn -.->|"refresh in · clear auth · set anon"| cookie`

const passwordChangeChart = `flowchart LR
  form(["/settings"]) -->|"current password"| reverifyFn["handlePasswordReverify"]
  reverifyFn -->|"rate limit + requireAuth"| mw1["rateLimit · requireAuth"] -->|"runOp"| reverifyOp["passwordReverify"]
  reverifyOp -->|"pre-check"| logs[("activities · bans")]
  reverifyOp -->|"verify / rehash"| users[("users")]
  reverifyOp -->|"verify / rehash"| hash{{"AuthHasher DO"}}
  reverifyOp -->|"fresh sudo · access JWE"| access[/"access cookie"/]
  reverifyOp -->|"log"| logs
  form -->|"new password"| changeFn["handlePasswordChange · strength check"]
  changeFn -->|"rate limit + requireAuth"| mw2["rateLimit · requireAuth"] -->|"runOp"| changeOp["passwordChange"]
  changeOp -->|"pre-check"| logs
  changeOp -->|"live session"| sessionArchive[("sessions · sessions_archive")]
  changeOp -->|"sudo lease · stale fails"| sudo{"sudoExpiresAt"}
  changeOp -->|"update hash"| users
  changeOp -->|"hash new password"| hash
  changeOp -->|"optional: archive all"| sessionArchive
  changeOp -->|"optional: anon token"| anon[/"anon cookie"/]
  changeOp -->|"confirm"| mail{{"EmailService"}}
  changeOp -->|"log"| logs
  changeFn -.->|"read sudo · optionally clear auth · set anon"| access`

const authFlows: FeatureFlow[] = [
	{
		key: 'create-account',
		name: 'Create account',
		routes: ['/sign-up'],
		serverFunctions: ['handleEmailRequestPasscode', 'handleEmailVerifyPasscode'],
		ops: ['registerAnon', 'emailRequestPasscode', 'emailVerifyPasscode'],
		models: [
			'anons',
			'anons_archive',
			'auth_attempts',
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
			'A registered anon whose row is missing is replaced with a fresh identity and the request retried once.',
			'New emails create the account and session. Local email lands in Mailpit.',
			'Failed sends archive the verification row immediately. Wrong codes count up to the verifier’s attempt limit before the row is archived.',
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
			'auth_attempts',
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
			'A registered anon whose row is missing is replaced with a fresh identity and the request retried once.',
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
			'Refresh runs only when the access cookie is missing or invalid. The current generation rotates the session nonce and both token cookies, and records a short-lived grace token on the session for retries.',
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
			'Archives sessions, clears auth cookies, and issues a fresh Anon on success.',
			'Single sign-out verifies the refresh token. Sign out all verifies that the refresh session is still live and its nonce matches, then archives every Session; a dead session surfaces an error instead of a local sign-out.',
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
]

const references = [
	{
		label: 'OWASP password storage',
		href: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
	},
	{
		label: 'OWASP session management',
		href: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html',
	},
	{label: 'RFC 9106: Argon2', href: 'https://www.rfc-editor.org/rfc/rfc9106'},
]

/** Topic docs for accounts, sessions, and the identity they produce. */
export function AuthPanel() {
	return (
		<>
			<PanelHeader
				title="Auth"
				description="Accounts, sessions, and the identity checked on every request."
			/>

			<PanelSection id="auth-identity" title="Identity model">
				<Prose>
					A request is always one of two things: a User with a session, or an Anon with an anonymous
					identity. The identity middleware resolves one before any server function or route guard
					runs.
				</Prose>
				<PanelList>
					<PanelRow label="User">
						An account with an email and an optional password. A User is created only after a
						passcode sent to that email is verified.
					</PanelRow>
					<PanelRow label="Session">
						One sign-in. The row stores the refresh generation, device metadata, and a 30-day expiry
						(the <InlineCode>expiresAt</InlineCode> default in{' '}
						<InlineCode>src/db/models/sessions/schemas.ts</InlineCode>). Revoking the session ends
						that sign-in.
					</PanelRow>
					<PanelRow label="Anon">
						A signed {ANON_COOKIE_WEEKS}-week JWS cookie (<InlineCode>ANON_COOKIE_WEEKS</InlineCode>{' '}
						in <InlineCode>src/db/ops/auth/anons/consts.ts</InlineCode>, applied by{' '}
						<InlineCode>setAnonCookie</InlineCode> in{' '}
						<InlineCode>src/middleware/_set-anon-cookie.ts</InlineCode>). It stays stateless until
						the first meaningful action creates an <InlineCode>anons</InlineCode> row.
					</PanelRow>
				</PanelList>
				<Prose>
					At sign-up the Anon row archives with the new <InlineCode>userId</InlineCode>, and its
					activities and bans re-point to the archive. Say Anon, never guest.
				</Prose>
				<Prose>
					See <PanelLink panel="middleware">Middleware & identity</PanelLink> for token resolution
					and degraded states, and <PanelLink panel="route-guards">Route guards</PanelLink> for
					which route group a page belongs in. Credential requests also pass through the limits and
					bans in <PanelLink panel="abuse">Rate limits & bans</PanelLink>.
				</Prose>
			</PanelSection>

			<PanelSection id="auth-email-verification" title="Email verification">
				<Prose>
					A six-digit passcode (<InlineCode>Passcode</InlineCode> in{' '}
					<InlineCode>src/isomorphic/validators.ts</InlineCode>) authorizes account creation.
					Verify-before-create means every User is verified by construction: no User row exists
					until a code sent to the address is accepted.
				</Prose>
				<PanelList>
					<PanelRow label="lifetime">
						Fifteen minutes (the <InlineCode>expiresAt</InlineCode> default in{' '}
						<InlineCode>src/db/models/email-verifications/schemas.ts</InlineCode>). A new request
						replaces the active row for that email and identity; see{' '}
						<PanelLink panel="email">Email</PanelLink> for the resend gate.
					</PanelRow>
					<PanelRow label="attempts">
						{PASSCODE_MAX_ATTEMPTS} wrong codes retire the row (
						<InlineCode>PASSCODE_MAX_ATTEMPTS</InlineCode> in{' '}
						<InlineCode>src/db/ops/auth/strategies/email/consts.ts</InlineCode>). The next request
						mints a fresh one.
					</PanelRow>
					<PanelRow label="storage">
						Only the Argon2id hash is stored. A send failure archives the row immediately, so a
						retry cannot race an undelivered code.
					</PanelRow>
					<PanelRow label="cross-flow">
						One active row exists per email and identity. Sign-up and sign-in share the Anon’s code;
						reverify uses the User’s row. Anon-keyed codes verify only in the browser that requested
						them; User-keyed codes work from any signed-in device. A code stays valid until it is
						burned or expires.
					</PanelRow>
					<PanelRow label="delivery">
						Development sends to Mailpit. Production uses the configured email transport.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="auth-flows" title="Flows">
				<Prose>
					Each flow is a real request path. Expand one for the route, server functions, ops, and
					models it touches.
				</Prose>
				<FeatureFlows flows={authFlows} idPrefix="auth" />
			</PanelSection>

			<PanelSection id="auth-sessions" title="Sessions and tokens">
				<PanelList>
					<PanelRow label="access">
						JWE, {accessTokenMinutes} minutes (
						<InlineCode>ACCESS_TOKEN_EXPIRATION_MILLISECONDS</InlineCode> in{' '}
						<InlineCode>src/db/ops/auth/tokens/consts.ts</InlineCode>). Carries{' '}
						<InlineCode>userId</InlineCode> and the optional sudo expiry, and is verified by
						decryption with no Postgres round trip.
					</PanelRow>
					<PanelRow label="refresh">
						JWS, tied to the Session lifetime (the <InlineCode>expiresAt</InlineCode> default in{' '}
						<InlineCode>src/db/models/sessions/schemas.ts</InlineCode>). The session stores only the
						nonce hash; each refresh rotates the nonce, the generation, and both cookies.
					</PanelRow>
					<PanelRow label="refresh grace">
						A {REFRESH_GRACE_SECONDS}-second encrypted successor nonce (
						<InlineCode>graceExpiresAt</InlineCode>, from{' '}
						<InlineCode>REFRESH_GRACE_SECONDS</InlineCode> in{' '}
						<InlineCode>src/db/ops/auth/sessions/consts.ts</InlineCode>). A token one generation
						behind replays through it; anything older revokes the session and notifies the owner. A
						future generation is rejected without revoking.
					</PanelRow>
					<PanelRow label="cookies">
						<InlineCode>access</InlineCode>, <InlineCode>refresh</InlineCode>, and{' '}
						<InlineCode>anon</InlineCode> are httpOnly, SameSite=Lax, path{' '}
						<InlineCode>/</InlineCode>, and secure in production. Production prefixes them with{' '}
						<InlineCode>__Host-Http-</InlineCode> and omits <InlineCode>Domain</InlineCode>{' '}
						(host-only); dev uses plain names plus the branch suffix. Issuing auth cookies deletes
						the Anon cookie.
					</PanelRow>
					<PanelRow label="rollout">
						Changing a token type’s derivation invalidates every token of that type minted before
						the deploy. The README deployment checklist owns the rotation steps;{' '}
						<PanelLink panel="abuse">Rate limits & bans</PanelLink> owns the failure weights.
					</PanelRow>
				</PanelList>
				<Prose>
					A definitive invalid refresh token clears both auth cookies and continues as an Anon. A
					rate-limit rejection keeps them. An infrastructure failure never looks like an invalid
					token: the request is rejected with 503 before the handler. Middleware & identity owns
					that decision table. Per-token failure weights live in{' '}
					<PanelLink panel="abuse">Rate limits & bans</PanelLink>; the table owns the states and
					weights.
				</Prose>
			</PanelSection>

			<PanelSection id="auth-sudo" title="Sudo">
				<Prose>
					Sudo is a five-minute lease (<InlineCode>SUDO_EXPIRATION_WINDOW</InlineCode> in{' '}
					<InlineCode>src/db/ops/auth/consts.ts</InlineCode>) minted into the access token after a
					fresh password or email check. Email change, password change, and account removal require
					it; a stale lease fails before any write with a reverify message.
				</Prose>
				<Prose>
					Sign-in grants the lease because the user just proved the password. Prompting for the same
					password seconds later is friction without stopping anyone who already knows it. Requiring
					an emailed code for every sudo action would break password-only recovery for people who
					lost their old inbox, so that step is deferred until a lost-email recovery flow exists.
				</Prose>
				<Prose>
					<InlineCode>useHasSudo()</InlineCode> reads the lease in the client. Settings components
					gate destructive actions on it and open the reverify drawer when it is missing or expired.
					The read-only email lookup is sudo-gated but skips the live-session check, so Settings
					does not pay a session lookup on every render.
				</Prose>
			</PanelSection>

			<PanelSection id="auth-removal" title="Sign-out and removal">
				<PanelList>
					<PanelRow label="sign out">
						Verifies the refresh token, archives that Session, clears both auth cookies, and issues
						a fresh Anon. If the session is already invalid, revoked, or expired, it clears the
						cookies without an Anon; the next request issues one.
					</PanelRow>
					<PanelRow label="sign out all">
						Verifies the refresh token, requires its Session to still be live in the database and to
						belong to the authenticated User, and checks the refresh nonce (current or grace
						generation); then archives every Session for the User, clears the cookies, and issues a
						new Anon. Unlike single sign-out, a dead session surfaces an error and keeps the cookie
						pair. A failed nonce check keeps that strict error at weight 0: it cannot archive
						anything, and the stale state must not ban the account’s recovery path.
					</PanelRow>
					<PanelRow label="stale session">
						The settings session list covers every live Session for the User, so a result without
						the current Session means this device has no live Session — missing, revoked, expired,
						foreign, or unreadable — and the handler clears both auth cookies and returns an empty
						list; the page then refreshes the router and the guard redirects to sign-in. It is a
						POST with a logout side effect — never load or prefetch it from a route loader or a
						query prefetch. Auth transitions also clear the client cache (
						<InlineCode>clearIdentityCache</InlineCode>) and notify other open tabs, so another tab
						does not keep the previous user’s sessions, profile, or sudo-gated email. Any protected
						action that already ran its live-session check clears the same cookies when it fails,
						without an extra read; <InlineCode>useDeadSessionRecovery</InlineCode> then clears the
						identity cache and refreshes the router, so the page does not keep rendering the dead
						identity. The reverify check blocks an evicted device from minting a replacement token,
						so the access token cannot outlive its Session by more than the remaining access-token
						lifetime.
					</PanelRow>
					<PanelRow label="liveness check">
						Session liveness is one prepared primary-key lookup per guarded action, never per render
						or per row. The production Hyperdrive config must be cache-disabled: writes do not
						invalidate cached reads, so caching cannot be left to its default. Liveness queries
						contain <InlineCode>now()</InlineCode> and are uncacheable by accident; never rely on
						that for freshness.
					</PanelRow>
					<PanelRow label="remove account">
						Requires sudo. Archives the User; sessions and email verifications archive with it, and
						activities and bans re-point to the user archive. The request leaves with a fresh Anon.
					</PanelRow>
					<PanelRow label="repeat removal">
						A concurrent removal is treated as success; the desired end state is already true.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="auth-notes" title="Design notes">
				<PanelList>
					<PanelRow label="tokens">
						Self-rolled JWE/JWS plus database Sessions instead of an auth provider, so revocation
						and ban checks run inline. Access tokens are stateless until expiry; refresh rotation is
						the revocation point.
					</PanelRow>
					<PanelRow label="verify first">
						No User row exists before inbox proof, so unverified email and password PII never lands
						in the database.
					</PanelRow>
					<PanelRow label="revocation">
						All-or-own only. There is no per-session revoke, because a stolen cookie could otherwise
						run a watcher loop against every new Session the owner creates.
					</PanelRow>
					<PanelRow label="at rest">
						Passcodes and refresh nonces are Argon2id hashes; the grace nonce is encrypted under a
						separate secret set. Each token purpose derives a separate key, so one derived key
						cannot stand in for another.
					</PanelRow>
					<PanelRow label="secrets">
						Purpose tags do not protect a shared master secret. Production needs a distinct secret
						set per token purpose, per environment, and per database; the generator is deferred.
					</PanelRow>
					<PanelRow label="passcode limits">
						No cross-identity per-email cooldown — an attacker could exhaust it and lock the owner
						out. The per-IP limits, send ceiling, and ban scopes — including the accepted shared-NAT
						cost — live in <PanelLink panel="abuse">Rate limits & bans</PanelLink>.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelReferences links={references} />
		</>
	)
}

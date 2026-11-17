import {PanelLink, PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'
import {FeatureFlows, type FeatureFlow} from '../feature-blocks.tsx'

const requestPasscodeChart = (formPath: string) => `flowchart LR
  form(["${formPath}"]) -->|"email + intent"| fn["handleEmailRequestPasscode"]
  fn -->|"rate limit"| rl["rateLimit"] -->|"runOp"| op["emailRequestPasscode"]
  fn -->|"runOp · if unregistered"| reg["registerAnon"] -->|"insert"| anons[("anons")]
  reg -->|"log"| logs[("activities · bans")]
  reg -.->|"registered anon · Set-Cookie"| cookie[/"anon cookie"/]
  op -->|"pre-check"| logs
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
  op -->|"wrong / expired"| retry["count attempt · archive at 4"]
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
  menu(["/settings · user menu"]) -->|"this device"| outFn["handleSignOut"] --> authOut["requireAuth"] -->|"runOp"| outOp["signOut"]
  outOp -->|"refresh JWS"| secrets{{"authLayer secrets"}}
  outOp -->|"verify nonce"| hash{{"AuthHasher DO"}}
  outOp -->|"read"| active[("sessions")]
  outOp -->|"archive"| sessions[("sessions_archive")]
  outOp -->|"log"| logs[("activities · bans")]
  outFn -.->|"refresh in · clear auth · set anon"| cookie[/"Set-Cookie"/]
  menu -->|"all devices"| allFn["handleSignOutAll"] --> authAll["requireAuth"] -->|"runOp"| allOp["signOutAll"]
  allOp -->|"access JWE"| secrets{{"authLayer secrets"}}
  allOp -->|"archive by user"| sessions
  allOp -->|"log"| logs
  allFn -.->|"access in · clear auth · set anon"| cookie`

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
  changeOp -->|"sudo lease · stale fails"| sudo{"sudoExpiresAt"}
  changeOp -->|"update hash"| users
  changeOp -->|"hash new password"| hash
  changeOp -->|"optional: archive all"| sessionArchive[("sessions · sessions_archive")]
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
						One sign-in. The row stores the refresh generation, device metadata, and a 30-day
						expiry. Revoking the session ends that sign-in.
					</PanelRow>
					<PanelRow label="Anon">
						A signed eight-week JWS cookie. It stays stateless until the first meaningful action
						creates an <InlineCode>anons</InlineCode> row.
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
					bans in <PanelLink panel="abuse">Abuse protection</PanelLink>.
				</Prose>
			</PanelSection>

			<PanelSection id="auth-email-verification" title="Email verification">
				<Prose>
					A six-digit passcode authorizes account creation. Verify-before-create means every User is
					verified by construction: no User row exists until a code sent to the address is accepted.
				</Prose>
				<PanelList>
					<PanelRow label="lifetime">
						Fifteen minutes. A new request replaces the active row for that email and identity,
						subject to a short resend cooldown.
					</PanelRow>
					<PanelRow label="attempts">
						Four wrong codes retire the row. The next request mints a fresh one.
					</PanelRow>
					<PanelRow label="storage">
						Only the Argon2id hash is stored. A send failure archives the row immediately, so a
						retry cannot race an undelivered code.
					</PanelRow>
					<PanelRow label="cross-flow">
						One active row exists per email and identity. Sign-up and sign-in share the Anon’s code;
						reverify uses the User’s row. A code stays valid until it is burned or expires.
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
						JWE, 15 minutes. Carries <InlineCode>userId</InlineCode> and the optional sudo expiry,
						and is verified by decryption with no Postgres round trip.
					</PanelRow>
					<PanelRow label="refresh">
						JWS, tied to a 30-day Session. The session stores only the nonce hash; each refresh
						rotates the nonce, the generation, and both cookies.
					</PanelRow>
					<PanelRow label="refresh grace">
						A 30-second encrypted successor nonce. A token one generation behind replays through it;
						anything older revokes the session and notifies the owner. A future generation is
						rejected without revoking.
					</PanelRow>
					<PanelRow label="cookies">
						<InlineCode>access</InlineCode>, <InlineCode>refresh</InlineCode>, and{' '}
						<InlineCode>anon</InlineCode> are httpOnly, SameSite=Lax, path{' '}
						<InlineCode>/</InlineCode>, and secure in production. Production prefixes them with{' '}
						<InlineCode>__Http-</InlineCode>. Issuing auth cookies deletes the Anon cookie.
					</PanelRow>
				</PanelList>
				<Prose>
					A definitive invalid refresh token clears both auth cookies and continues as an Anon. A
					rate-limit rejection keeps them. An infrastructure failure never looks like an invalid
					token: the request is rejected with 503 before the handler. Middleware & identity owns
					that decision table.
				</Prose>
			</PanelSection>

			<PanelSection id="auth-sudo" title="Sudo">
				<Prose>
					Sudo is a five-minute lease minted into the access token after a fresh password or email
					check. Email change, password change, and account removal require it; a stale lease fails
					before any write with a reverify message.
				</Prose>
				<Prose>
					<InlineCode>useHasSudo()</InlineCode> reads the lease in the client. Settings components
					gate destructive actions on it and open the reverify drawer when it is missing or expired.
				</Prose>
			</PanelSection>

			<PanelSection id="auth-removal" title="Sign-out and removal">
				<PanelList>
					<PanelRow label="sign out">
						Verifies the refresh token, archives that Session, clears both auth cookies, and issues
						a fresh Anon.
					</PanelRow>
					<PanelRow label="sign out all">
						Uses the access token to archive every Session for the User, then clears the cookies and
						issues a new Anon.
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

			<PanelReferences links={references} />
		</>
	)
}

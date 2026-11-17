import {CodeBlock, PromptBlock} from '../../code-block.tsx'
import {PanelLink} from '../../doc-links.tsx'
import {InlineCode, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'
import {FeatureActions, FeatureShell} from '../feature-blocks.tsx'

const routeGroups = `src/routes/
  _auth-protected/reports/route.tsx   // signed-in only
  _auth-dynamic/(home)/index.tsx      // renders for everyone
  _auth-anon/about/route.tsx          // public`

const protectedServerFn = `export const handleGetUserProfile = createServerFn({method: 'GET'})
	.middleware([requireAuth])
	.handler(async ({context: {auth: {userId}, ipAddress}}) => {
		return await runOp({
			op: getUserProfile,
			data: {userId, ipAddress},
			layers: [authLayer, dbLayer],
		})
	})`

const actions = [
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
]

const googlePrompt =
	'Add Google OAuth sign-in. Add a callback route, match or create a User by verified email, reuse createSession and retireAnon, and store the provider subject on the User.'

const passkeyPrompt =
	'Add passkey sign-in. Register a WebAuthn credential from Settings, store the credential id and public key per User, and add a sign-in button that resolves a User then reuses createSession and retireAnon.'

const totpPrompt =
	'Add TOTP two-factor. Enroll a secret in Settings, require a six-digit code after password verification and before session creation, and issue recovery codes. Store the secret encrypted at rest.'

/** Catalog entry for the auth feature. Details live in the Auth reference panel. */
export function AuthFeature() {
	return (
		<FeatureShell title="Auth" summary="Create accounts, verify emails, and keep sessions secure.">
			<PanelSection id="auth-pages" title="Built-in pages">
				<Prose>
					The app ships with sign-up, sign-in, and account settings. Open one to see the flow, or
					start with the pages and change the copy.
				</Prose>
				<FeatureActions actions={actions} />
			</PanelSection>

			<PanelSection id="auth-protect" title="Protect a page">
				<Prose>
					The route folder is the guard. A route under <InlineCode>_auth-protected</InlineCode>{' '}
					redirects Anons to <InlineCode>/sign-in</InlineCode> and returns them to the page
					afterward.
				</Prose>
				<CodeBlock code={routeGroups} label="Route groups" language="text" />
				<Prose>
					The folder guards the screen, not the data. Every server function that reads private data
					also adds <InlineCode>requireAuth</InlineCode> and reads the verified User from the
					context.
				</Prose>
				<CodeBlock
					code={protectedServerFn}
					label="Protected server function"
					language="typescript"
				/>
				<Prose>
					Inside a protected route, <InlineCode>Route.useRouteContext()</InlineCode> returns{' '}
					<InlineCode>auth</InlineCode>. In a <InlineCode>_auth-dynamic</InlineCode> route it is{' '}
					<InlineCode>null</InlineCode> for Anons. Server functions see both{' '}
					<InlineCode>context.auth</InlineCode> and <InlineCode>context.anon</InlineCode>.
				</Prose>
			</PanelSection>

			<PanelSection id="auth-account" title="Manage the account">
				<Prose>
					Settings covers credentials and sessions. Changes that could lock someone out require
					sudo: a five-minute lease minted by re-entering a password or verifying an emailed code.
				</Prose>
				<PanelList>
					<PanelRow label="Password">
						Change it in Settings → Access & Security. The drawer can sign out all sessions,
						including this device, and sends a confirmation email.
					</PanelRow>
					<PanelRow label="Email">
						Change it in Settings → Profile. Verify a code sent to the new address; the old address
						stops working once the change lands.
					</PanelRow>
					<PanelRow label="Sessions">
						Settings → Access & Security lists active sessions with device and location. Sign out
						one device or all devices.
					</PanelRow>
					<PanelRow label="Removal">
						Settings → Access & Security archives the account and everything attached to it. There
						is no undelete.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<div className="mt-8 border-t pt-5">
				<p className="text-sm font-medium">Full reference</p>
				<p className="mt-1 text-sm text-muted-foreground">
					See the <PanelLink panel="auth">Auth reference</PanelLink> for the identity model, token
					rotation, sudo, and every flow.
				</p>
			</div>

			<PanelSection id="auth-extend" title="Extension prompts" className="border-t pt-6">
				<PromptBlock title="Add Google OAuth" prompt={googlePrompt} />
				<PromptBlock title="Add passkeys" prompt={passkeyPrompt} />
				<PromptBlock title="Add TOTP two-factor" prompt={totpPrompt} />
			</PanelSection>
		</FeatureShell>
	)
}

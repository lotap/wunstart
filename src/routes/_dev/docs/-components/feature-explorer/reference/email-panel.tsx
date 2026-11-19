import {localServices} from '../../../-utils/local-services.ts'
import {CommandBlock} from '../../code-block.tsx'
import {PanelLink, PanelReferences} from '../../doc-links.tsx'
import {
	InlineCode,
	MicroLabel,
	PanelHeader,
	PanelList,
	PanelRow,
	PanelSection,
	Prose,
} from '../../doc-ui.tsx'

export function EmailPanel() {
	return (
		<>
			<PanelHeader
				title="Email"
				description="Verification, notifications, rendering, and delivery."
			/>

			<PanelSection id="email-flow" title="Flow">
				<Prose>
					Email is part of auth, not a side channel. Sign-up uses verify-before-create: a six-digit
					passcode proves inbox control before a User row exists. The request response is identical
					whether the address is registered or not, so the flow cannot be used to enumerate
					accounts. See <PanelLink panel="auth">Auth</PanelLink> for the passcode tables and session
					rules.
				</Prose>
				<PanelList>
					<PanelRow label="Request" labelVariant="text">
						Rate-limited before the op runs. A sign-in request for an unknown address sends the
						no-account notice instead of a code; the response shape stays the same.
					</PanelRow>
					<PanelRow label="Request paths" labelVariant="text">
						Sign-up and sign-in requests require an Anon. Reverify and email-change requests require
						a signed-in User and a live session; email change also requires sudo at request and
						confirm time.
					</PanelRow>
					<PanelRow label="Resend" labelVariant="text">
						A re-request replaces the active row, unless it was sent less than about a minute ago.
						There is no per-email cap: an attacker could exhaust it and lock the owner out, so
						per-IP limits and weighted bans are the ceiling.
					</PanelRow>
					<PanelRow label="Deliverable mail" labelVariant="text">
						The code is rendered before the verification row commits. A render failure fails the op;
						a send failure retires the intent so a retry mints a fresh code.
					</PanelRow>
					<PanelRow label="Verify" labelVariant="text">
						A valid code creates the User or signs in, then archives the burnt intent. Sign-in sends
						the notification after commit.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="email-delivery" title="Delivery">
				<Prose>
					<InlineCode>EmailService</InlineCode> is the send facade. The transport is selected by{' '}
					<InlineCode>EMAIL_TRANSPORT</InlineCode>: development defaults to Mailpit over HTTP;
					production defaults to the Workers <InlineCode>send_email</InlineCode> binding, with{' '}
					<InlineCode>EMAIL_FALLBACK</InlineCode> behind it. The in-tree fallback is an example, not
					an endorsement — verify it or swap in your provider.
				</Prose>
				<PanelList>
					<PanelRow label="Deliverable mail" labelVariant="text">
						Passcode email for sign-up, sign-in, and reverify. Render before commit; a render
						failure fails the op. A send failure retires the just-minted code so a retry mints a
						fresh one.
					</PanelRow>
					<PanelRow label="Notifications" labelVariant="text">
						Sign-in, password-change, email-change, and session-reuse notices. Send them best-effort
						after commit; failures are logged and never fail the op.
					</PanelRow>
					<PanelRow label="No outbox" labelVariant="text">
						Notifications are not persisted or retried. Codes are hashed, and bodies or tokens never
						reach the activity log.
					</PanelRow>
					<PanelRow label="Failure kinds" labelVariant="text">
						<InlineCode>config</InlineCode>, <InlineCode>transient</InlineCode>,{' '}
						<InlineCode>rejected</InlineCode>, and <InlineCode>ambiguous</InlineCode>. A rejected or
						ambiguous send is never retried; the chain retries once only when every hop provably did
						not accept the message.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="email-templates" title="Templates and preview">
				<Prose>
					Templates use React Email through the shared{' '}
					<InlineCode>src/email/components/email-layout.tsx</InlineCode>: tinted page, card,
					wordmark, and footer. <InlineCode>X.PreviewProps</InlineCode> supplies preview data;{' '}
					<InlineCode>renderX()</InlineCode> returns the subject, HTML, and text via a dual render.
					The Tailwind config is hex-only because the email inliner cannot handle the app’s oklch
					tokens. Inter is declared but not loaded; the system stack is the real fallback.
				</Prose>
				<Prose>
					The wordmark URL is built from <InlineCode>APP_URL</InlineCode> plus the{' '}
					<InlineCode>wordmarkPath</InlineCode> constant in the layout. Rebranding replaces the
					asset and updates that constant. Preview values live in{' '}
					<InlineCode>src/email/preview.ts</InlineCode> and point at the app on{' '}
					<InlineCode>http://localhost:3000</InlineCode>, so keep the app dev server up alongside
					the preview.
				</Prose>
				<MicroLabel>Run this in a terminal</MicroLabel>
				<div className="max-w-md">
					<CommandBlock command={localServices.reactEmailCommand} label="React Email dev command" />
				</div>
			</PanelSection>

			<PanelSection id="email-security" title="Security and UX">
				<Prose>
					Account and security email contains no links or CTAs. The action is a code or a typed
					address, never a button, so the product does not train people to click links in mail.
				</Prose>
				<PanelList>
					<PanelRow label="No links" labelVariant="text">
						Verification codes, security details, and the no-account sign-up address are plain
						content. The address is shown as text, not a link.
					</PanelRow>
					<PanelRow label="Light-only" labelVariant="text">
						<InlineCode>color-scheme</InlineCode> and{' '}
						<InlineCode>supported-color-schemes</InlineCode> keep the email light. Do not add a dark
						wordmark swap: <InlineCode>prefers-color-scheme</InlineCode> can report dark while the
						card stays light, and Gmail and Outlook ignore full dark variants.
					</PanelRow>
					<PanelRow label="No enumeration" labelVariant="text">
						Registered and unregistered addresses get the same response. Only the inbox owner sees
						whether an account exists.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="email-configuration" title="Configuration">
				<Prose>
					Development uses the defaults below. Production must set <InlineCode>APP_URL</InlineCode>{' '}
					to the public origin and <InlineCode>EMAIL_FROM</InlineCode> to a verified sender.
				</Prose>
				<PanelList>
					<PanelRow label="EMAIL_FROM">
						Sender address. Defaults to <InlineCode>noreply@wunstart.com</InlineCode>; override it
						for your domain.
					</PanelRow>
					<PanelRow label="APP_URL">
						Public origin used for the wordmark and the no-account sign-up address. Defaults to{' '}
						<InlineCode>http://localhost:3000</InlineCode>.
					</PanelRow>
					<PanelRow label="EMAIL_TRANSPORT">
						<InlineCode>mailpit</InlineCode>, <InlineCode>sendemail</InlineCode>, or{' '}
						<InlineCode>brevo</InlineCode>. Development defaults to Mailpit; production defaults to{' '}
						<InlineCode>sendemail</InlineCode>.
					</PanelRow>
					<PanelRow label="EMAIL_FALLBACK">
						Comma-separated fallback transports. Defaults to <InlineCode>brevo</InlineCode> in
						production and empty in development.
					</PanelRow>
					<PanelRow label="MAILPIT_URL">
						Local Mailpit endpoint used by the development transport.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelReferences
				links={[
					{label: 'React Email documentation', href: 'https://react.email/docs'},
					{label: 'React Email CLI', href: 'https://react.email/docs/cli'},
					{
						label: 'Cloudflare Email Workers',
						href: 'https://developers.cloudflare.com/workers/runtime-apis/bindings/send-email/',
					},
					{
						label: 'Brevo transactional email',
						href: 'https://developers.brevo.com/docs/send-a-transactional-email',
					},
				]}
			/>
		</>
	)
}

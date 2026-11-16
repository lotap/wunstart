import {localServices} from '../../../-content/local-development.ts'
import {CommandBlock} from '../../code-block.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {
	InlineCode,
	MicroLabel,
	PanelHeader,
	PanelList,
	PanelRow,
	PanelSection,
	Prose,
} from '../../doc-ui.tsx'

export function ReactEmailPanel() {
	return (
		<>
			<PanelHeader
				title="React Email"
				description="Preview and edit email templates without sending mail."
			/>

			<PanelSection id="react-email-preview" title="Preview server">
				<Prose>
					React Email renders the templates in <InlineCode>src/email/templates</InlineCode> at{' '}
					<InlineCode>{localServices.reactEmailUrl}</InlineCode> and hot-reloads edits, so you can
					check layout and copy before sending. Run it alongside the app. Mailpit still catches the
					mail the app sends; this previews the templates themselves.
				</Prose>
				<MicroLabel>Run this in a terminal</MicroLabel>
				<div className="max-w-md">
					<CommandBlock command={localServices.reactEmailCommand} label="React Email dev command" />
				</div>
			</PanelSection>

			<PanelSection id="email-delivery" title="Delivery">
				<Prose>
					The transport is selected by <InlineCode>EMAIL_TRANSPORT</InlineCode>. Development
					defaults to Mailpit over HTTP; production defaults to the Workers{' '}
					<InlineCode>send_email</InlineCode> binding, with <InlineCode>EMAIL_FALLBACK</InlineCode>{' '}
					behind it. The in-tree fallback is an example, not an endorsement: verify it or swap in
					your provider.
				</Prose>
				<PanelList>
					<PanelRow label="Deliverable mail" labelVariant="text">
						Verification and password-change codes. Render before commit; a render failure fails the
						op. A send failure retires the just-minted code so a retry mints a fresh one.
					</PanelRow>
					<PanelRow label="Notifications" labelVariant="text">
						Sign-in, password-change, and session-reuse notices. Send them best-effort after commit;
						failures are logged and never fail the op.
					</PanelRow>
					<PanelRow label="No outbox" labelVariant="text">
						Notifications are not persisted or retried. Codes are hashed, and bodies or tokens never
						reach the activity log.
					</PanelRow>
				</PanelList>

				<Prose>
					Templates use a hex-only Tailwind config because the email inliner cannot handle the app’s
					oklch tokens. <InlineCode>X.PreviewProps</InlineCode> supplies preview data;{' '}
					<InlineCode>renderX()</InlineCode> returns the subject, HTML, and text.
				</Prose>
			</PanelSection>

			<PanelReferences
				links={[
					{label: 'React Email documentation', href: 'https://react.email/docs'},
					{label: 'React Email CLI', href: 'https://react.email/docs/cli'},
				]}
			/>
		</>
	)
}

import {CodeBlock, PromptBlock} from '../../code-block.tsx'
import {PanelLink} from '../../doc-links.tsx'
import {InlineCode, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'
import {FeatureShell} from '../feature-blocks.tsx'

const stricterLimit = `const signInRateLimit = createRateLimit(3)

export const handlePasswordSignIn = createServerFn({method: 'POST'})
	.middleware([signInRateLimit, requireAnon])
	.validator(Schema.toStandardSchemaV1(EmailPasswordCredentials))
	.handler(async ({data, context}) => {
		// run passwordSignIn, then set auth cookies
	})`

const captchaPrompt =
	'Add a Cloudflare Turnstile challenge after three failed credential attempts. Verify the token server-side before the credential op and store only the verification outcome on the Activity.'

const durableLimiterPrompt =
	'Replace the in-memory rate-limit store with a Durable Object keyed by IP. Keep the 60-second window and the 12,600 threshold, expose one Durable Object binding, and fail open when the object is unavailable.'

const banAdminPrompt =
	'Add a ban management page under /settings. List active bans with scope, target, weight, and expiry; allow revoking one ban and show recent Activities for the target. Require sudo for revocation.'

/** Catalog entry for abuse protection. Details live in the Rate limits & bans reference panel. */
export function AbuseProtectionFeature() {
	return (
		<FeatureShell
			title="Abuse protection"
			summary="Rate-limit abusive requests and ban repeat offenders."
		>
			<PanelSection id="abuse-protected" title="What is protected">
				<Prose>
					Every server function is rate-limited per IP. Auth functions get a tighter limit, and
					credential ops check existing bans before they do any work.
				</Prose>
				<PanelList>
					<PanelRow label="All server functions">
						150 requests per minute per IP. Installed once in <InlineCode>src/start.ts</InlineCode>.
					</PanelRow>
					<PanelRow label="Auth functions">
						A tighter limiter sized for 5 requests per minute, on top of the global limit. Attach{' '}
						<InlineCode>rateLimit</InlineCode> to sign-up, sign-in, and passcode functions.
					</PanelRow>
					<PanelRow label="Credential ops">
						Check the IP, the claimed email, the User, and the Anon for active bans and excessive
						activity before verifying anything.
					</PanelRow>
					<PanelRow label="Failures">
						Every op logs an Activity. Enough weight in 10 minutes creates a temporary ban, which
						can extend up to 120 minutes.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="abuse-tighten" title="Tighten one endpoint">
				<Prose>
					Wrap the server function with a limiter sized for that endpoint. Three per minute is
					stricter than the shared auth limit.
				</Prose>
				<CodeBlock code={stricterLimit} label="Endpoint rate limit" language="typescript" />
				<Prose>
					The limiter is in-memory and per isolate. It rejects bursts in front of the op; it is not
					a global edge limit. Pair it with a Cloudflare rule or a Durable Object for that.
				</Prose>
			</PanelSection>

			<PanelSection id="abuse-bans" title="Bans and weight">
				<Prose>
					A ban blocks one scope: the IP, the email a failed attempt claimed, a User, or an Anon.
					Archived identities keep their bans. A later activity extends only a ban of its own scope.
				</Prose>
				<PanelList>
					<PanelRow label="threshold">
						12,600 weighted Activities in a 10-minute window per scope.
					</PanelRow>
					<PanelRow label="penalty">
						10 minutes at the threshold, doubling as weight accumulates, capped at 120 minutes.
					</PanelRow>
					<PanelRow label="weight">
						84 for a success. Credential failures use the op’s rate allowance, so a wrong password
						costs far more than a page read. A denial carries the full threshold.
					</PanelRow>
					<PanelRow label="known IP">
						A failed-credential ban rejects a new IP but lets the account owner sign in from an IP
						already on the User. A third party cannot lock the account out.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<div className="mt-10 border-t pt-6">
				<p className="text-base font-medium">Full reference</p>
				<p className="mt-2 text-base leading-relaxed text-muted-foreground">
					See the <PanelLink panel="abuse">Rate limits & bans reference</PanelLink> for limiter
					math, every ban scope, and the response contract.
				</p>
			</div>

			<PanelSection id="abuse-extend" title="Extension prompts" className="border-t pt-6">
				<PromptBlock title="Add a CAPTCHA challenge" prompt={captchaPrompt} />
				<PromptBlock title="Add a durable rate limiter" prompt={durableLimiterPrompt} />
				<PromptBlock title="Add ban management" prompt={banAdminPrompt} />
			</PanelSection>
		</FeatureShell>
	)
}

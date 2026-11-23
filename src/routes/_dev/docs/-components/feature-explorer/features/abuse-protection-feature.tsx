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

const sharedLimiterPrompt =
	'Replace the in-memory rate-limit store with a shared, atomic Redis-compatible service such as Redis, Valkey, or Upstash. Keep the 60-second weighted window (WINDOW_MS), the 12,600 threshold (EXCESSIVE_ACTIVITIES_THRESHOLD), the op denial penalty, and the network keying (ipNetwork in src/db/helpers/ip-network.ts); read the connection from environment config and fail open when the store is unavailable. The attempt ceiling and Postgres bans remain the durable bounds; this layer only rejects bursts across instances.'

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
					credential ops check existing bans, then reserve attempt counters, before they do any
					work.
				</Prose>
				<PanelList>
					<PanelRow label="All server functions">
						150 requests per minute per IP, set by <InlineCode>createRateLimit(150)</InlineCode> in{' '}
						<InlineCode>src/start.ts</InlineCode>.
					</PanelRow>
					<PanelRow label="Auth functions">
						Defaults to 5 requests per minute (<InlineCode>rateLimit</InlineCode> in{' '}
						<InlineCode>src/middleware/rate-limit.ts</InlineCode>), on top of the global limit.
						Attach <InlineCode>rateLimit</InlineCode> to sign-up, sign-in, and passcode functions.
					</PanelRow>
					<PanelRow label="Attempt ceiling">
						Sign-in and passcode verification count presentations per client network and per claimed
						email in <InlineCode>auth_attempts</InlineCode>, before any hashing. The allowances live
						in <InlineCode>src/db/models/auth-attempts/consts.ts</InlineCode>. A denial is audited
						at weight 0, so it caps throughput without adding to a ban.
					</PanelRow>
					<PanelRow label="Credential ops">
						Check the IP, the claimed email, the User, and the Anon for active bans and excessive
						activity before verifying anything.
					</PanelRow>
					<PanelRow label="Failures">
						Ops log an Activity by default; <InlineCode>verifyAccess</InlineCode>,{' '}
						<InlineCode>verifyAnon</InlineCode>, and <InlineCode>signAnon</InlineCode> skip the
						success row. Enough weight in 10 minutes (
						<InlineCode>EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL</InlineCode>) creates a temporary ban,
						which can extend up to 120 minutes (<InlineCode>PENALTY_INTERVAL_MAX_QTY</InlineCode> in{' '}
						<InlineCode>src/db/models/bans/consts.ts</InlineCode>).
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
					a shared limit. Pair it with an edge rate-limiting rule or a shared Redis-compatible
					limiter for that.
				</Prose>
			</PanelSection>

			<PanelSection id="abuse-bans" title="Bans and weight">
				<Prose>
					A ban blocks one scope: the IP, the email a failed attempt claimed, a User, or an Anon.
					Archived identities keep their bans. A later activity extends only a ban of its own scope.
				</Prose>
				<PanelList>
					<PanelRow label="threshold">
						12,600 (<InlineCode>EXCESSIVE_ACTIVITIES_THRESHOLD</InlineCode>) weighted Activities in
						a 10-minute window (<InlineCode>EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL</InlineCode>) per
						scope.
					</PanelRow>
					<PanelRow label="penalty">
						10 minutes at the threshold, doubling as weight accumulates, capped at 120 minutes (
						<InlineCode>PENALTY_INTERVAL_INITIAL</InlineCode> and{' '}
						<InlineCode>PENALTY_INTERVAL_MAX_QTY</InlineCode> in{' '}
						<InlineCode>src/db/models/bans/consts.ts</InlineCode>).
					</PanelRow>
					<PanelRow label="weight">
						84 (<InlineCode>ACTIVITIES_BASELINE_WEIGHT</InlineCode>) for a success. Credential
						failures use the op’s rate allowance, so a wrong password costs far more than a page
						read. A ban refusal carries the full threshold; an attempt-ceiling denial carries zero.
					</PanelRow>
					<PanelRow label="known IP">
						A failed-credential ban rejects a new network but lets the account owner sign in from a
						network already on the User. A third party cannot lock the account out.
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
				<PromptBlock title="Add a shared rate limiter" prompt={sharedLimiterPrompt} />
			</PanelSection>
		</FeatureShell>
	)
}

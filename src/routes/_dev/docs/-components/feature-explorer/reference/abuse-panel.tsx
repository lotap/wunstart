import {DocDiagram} from '../../doc-diagram.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'

const guardrailsChart = `flowchart LR
  request(["Server fn request"]) -->|"150/min global · 5/min auth"| mw["rateLimit · per-IP score"]
  mw -->|"over limit"| denied["429"]
  mw -->|"server fn"| auth["verifyAuth"]
  auth -->|"fallback refresh"| refresh["30/min refresh · refresh:IP"]
  refresh -->|"over limit"| denied
  auth -->|"sign-out"| sout["30/min sign-out · sign-out:IP"]
  sout -->|"over limit"| denied
  auth -->|"server fn"| op["runOp · createOpsFn"]
  op -->|"credential ops"| check["checkCurrentBansAndExcessiveActivities"]
  check --> bans[("bans")]
  check --> activities[("activities")]
  op -->|"success / failure"| log["logActivityAndHandleBans"]
  log --> activities
  log -->|"extend / create"| bans
  op -->|"RateLimitError"| weight["extra IP weight"] --> denied`

const references = [
	{
		label: 'OWASP credential stuffing prevention',
		href: 'https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html',
	},
	{
		label: 'OWASP automated threats',
		href: 'https://owasp.org/www-project-automated-threats-to-web-applications/',
	},
	{
		label: 'Cloudflare rate limiting rules',
		href: 'https://developers.cloudflare.com/waf/rate-limiting-rules/',
	},
]

/** Topic docs for rate limits, activity weights, and bans. */
export function AbusePanel() {
	return (
		<>
			<PanelHeader
				title="Rate limits & bans"
				description="Request limits, weighted activity, and temporary bans."
			/>

			<PanelSection id="abuse-layers" title="Two layers">
				<Prose>
					The first layer is an in-memory request limiter. The second is a database-backed ban
					system fed by every op outcome. The limiter rejects bursts; bans reject a subject over a
					longer window.
				</Prose>
				<figure>
					<figcaption className="text-sm font-medium text-muted-foreground">
						Request path
					</figcaption>
					<div className="mt-2 rounded-xl border bg-muted/20 p-4">
						<DocDiagram
							source={guardrailsChart}
							label="Rate limits and bans request path"
							idPrefix="abuse-guardrails"
						/>
					</div>
				</figure>
				<Prose>
					<InlineCode>src/start.ts</InlineCode> installs{' '}
					<InlineCode>createRateLimit(150)</InlineCode> on every server function. Auth server
					functions add the tighter <InlineCode>rateLimit</InlineCode>; sign-out uses its own scoped{' '}
					<InlineCode>signOutRateLimit</InlineCode>, and fallback refresh attempts consume a
					separate <InlineCode>refresh</InlineCode> bucket before the refresh op runs. Ops log their
					outcome through <InlineCode>createOpsFn</InlineCode>, and credential ops pre-check bans
					before doing any work.
				</Prose>
			</PanelSection>

			<PanelSection id="abuse-request-limiter" title="Request limiter">
				<Prose>
					<InlineCode>createRateLimit(max)</InlineCode> admits <InlineCode>max</InlineCode> requests
					per IP in a 60-second window. Each request adds{' '}
					<InlineCode>ceil(12,600 / max)</InlineCode> to the IP’s score; the request that pushes the
					score above 12,600 gets a 429. The scoped refresh and sign-out buckets use the same
					formula at 30/min, so each attempt weighs 420 in its own key.
				</Prose>
				<PanelList>
					<PanelRow label="createRateLimit(150)">
						The global limiter: 150 requests per minute per IP. Installed in{' '}
						<InlineCode>src/start.ts</InlineCode>.
					</PanelRow>
					<PanelRow label="rateLimit">
						The auth limiter: sized for 5 requests per minute per IP on its own. Attach it to
						sign-up, sign-in, and passcode functions. It shares the global key, so a request that
						passes both limits consumes both weights from one budget.
					</PanelRow>
					<PanelRow label="refresh bucket">
						30 fallback refresh attempts per minute per IP. Keyed{' '}
						<InlineCode>refresh:&lt;ip&gt;</InlineCode> so it does not spend the global/auth score.
						Checked in <InlineCode>verifyAuth</InlineCode> before the refresh op; a normal browser
						refreshes about once per 15 minutes.
					</PanelRow>
					<PanelRow label="sign-out bucket">
						30 sign-out requests per minute per IP, keyed{' '}
						<InlineCode>sign-out:&lt;ip&gt;</InlineCode>. Both sign-out handlers run the refresh
						nonce check, but sign-out cannot guess a credential and a shared egress can sign out
						several devices at once, so the lane bounds the Argon2 work without spending the 5/min
						auth budget. The global limiter remains the outer bound.
					</PanelRow>
					<PanelRow label="storage">
						An in-memory <InlineCode>Map</InlineCode> in the Worker. It is per isolate, not shared
						across instances, and resets on deploy. Treat it as defense in depth, not a global edge
						limit.
					</PanelRow>
					<PanelRow label="stacking">
						The global and auth limiters feed the same per-IP score, so a request that passes both
						consumes both weights. The refresh and sign-out buckets have their own scoped keys and
						do not spend that budget.
					</PanelRow>
				</PanelList>
				<Prose>
					For a real cross-instance limit, add an edge rate-limiting rule or a shared
					Redis-compatible limiter (Redis, Valkey, Upstash). The in-memory limiter stays useful as
					the last local guard.
				</Prose>
			</PanelSection>

			<PanelSection id="abuse-activities" title="Activities and weight">
				<Prose>
					Every op logs an Activity unless it opts out with <InlineCode>logOnSuccess</InlineCode> or{' '}
					<InlineCode>logOnFailure</InlineCode>. The row records the outcome, weight, IP, and the
					User, Anon, or credential behind it.
				</Prose>
				<PanelList>
					<PanelRow label="baseline">
						84 for a successful activity, derived from 12,600 ÷ 150. A successful action alone never
						approaches the ban threshold.
					</PanelRow>
					<PanelRow label="passcode sends">
						Each successful passcode request weighs 2,100 instead, so six sends per IP in ten
						minutes reach the threshold. A refused resend mails nothing and carries no weight. The
						weight applies to the IP, Anon, and User scopes together, so a shared NAT can be banned
						for about twenty minutes; on a signed-in send it can also ban the account, which refuses
						its refresh until the ban lifts while the IP ban blocks signing in again from that
						address. Retries extend it.
					</PanelRow>
					<PanelRow label="credential failure">
						The op’s <InlineCode>rateAllowance</InlineCode> sets the weight: 4 allows about four
						failures per window, 6 about six. Wrong passwords, unknown emails, and bad codes share
						one generic message.
					</PanelRow>
					<PanelRow label="rate-limit denial">
						Carries the full 12,600. A denied attempt is enough to keep the subject banned on its
						own.
					</PanelRow>
					<PanelRow label="defect">
						Zero. A server-side defect is not user behavior and must not feed a ban.
					</PanelRow>
				</PanelList>
				<Prose>
					Activities are append-only. The daily cron archives rows older than 30 days, and{' '}
					<InlineCode>archive-old-activities</InlineCode> runs the same path from a VPS.
				</Prose>
			</PanelSection>

			<PanelSection id="abuse-bans" title="Bans">
				<Prose>
					A ban is one temporary block on one scope. Credential ops check the current bans and the
					last 10 minutes of weighted activity before they do any work. An IP, User, or Anon match
					rejects immediately; a failed-credential match follows the known-IP rule below.
				</Prose>
				<PanelList>
					<PanelRow label="IP_ADDRESS">
						The request IP. Applies to every op that receives an IP address.
					</PanelRow>
					<PanelRow label="FAILED_CREDENTIAL">
						The email an attempt claimed. Only applied when a User exists and the request comes from
						a new IP; a known IP can still sign in, so a third party cannot lock the account out.
					</PanelRow>
					<PanelRow label="USER">The signed-in User.</PanelRow>
					<PanelRow label="ANON">The anonymous identity.</PanelRow>
					<PanelRow label="ARCHIVED_*">
						The archive twins. Activities and bans follow a retired Anon or User so the history
						still applies.
					</PanelRow>
				</PanelList>
				<Prose>
					The window is 10 minutes and the threshold is 12,600 per scope. A new ban starts at 10
					minutes when the total weight is exactly at the threshold, grows with the accumulated
					weight, and caps at 120 minutes. A later activity extends only bans of its own scope, so a
					denied request cannot compound an unrelated ban.
				</Prose>
			</PanelSection>

			<PanelSection id="abuse-responses" title="What the caller sees">
				<PanelList>
					<PanelRow label="Limiter" labelVariant="text">
						HTTP 429 with “Slow down a bit, then try again.” The request never reaches the server
						function.
					</PanelRow>
					<PanelRow label="Ops rejection" labelVariant="text">
						HTTP 429. <InlineCode>runOp</InlineCode> adds the denial weight before the response
						leaves.
					</PanelRow>
					<PanelRow label="Anticipated failure" labelVariant="text">
						HTTP 422 with the op’s client-safe message. Credential failures deliberately share one
						message so the response does not reveal whether the account exists.
					</PanelRow>
					<PanelRow label="Unexpected failure" labelVariant="text">
						HTTP 500 with a generic message. Internal details stay in the logs.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelReferences links={references} />
		</>
	)
}

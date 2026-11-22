/**
 * Policy prose: the table or code owns the details; state the invariant and
 * link. Name the code path behind a behavioral claim.
 * Rules: .agents/skills/wunstart/references/docs.md § Policy prose.
 */
import {
	ACTIVITIES_BASELINE_WEIGHT,
	ACTIVITIES_RETENTION_WINDOW,
	EXCESSIVE_ACTIVITIES_THRESHOLD,
	EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL,
} from '#/db/models/activities/consts.ts'
import {
	PENALTY_INTERVAL_INITIAL,
	PENALTY_INTERVAL_MAX_QTY,
	PENALTY_INTERVAL_UNIT,
} from '#/db/models/bans/consts.ts'
import {PASSCODE_SENDS_PER_WINDOW} from '#/db/ops/auth/strategies/email/consts.ts'
import type {JwtFailureVerdict, TokenFailurePolicy} from '#/db/ops/auth/tokens/_jwt-utils.ts'
import {ACCESS_TOKEN_FAILURES} from '#/db/ops/auth/tokens/access-token-policies.ts'
import {ANON_TOKEN_FAILURES} from '#/db/ops/auth/tokens/anon-token-policies.ts'
import {GRACE_REPLAY_FAILURES} from '#/db/ops/auth/tokens/grace-token-policies.ts'
import {REFRESH_TOKEN_FAILURES} from '#/db/ops/auth/tokens/refresh-token-policies.ts'
import {allowRatePerWindow} from '#/db/ops/ops-error.ts'

import {DocDiagram} from '../../doc-diagram.tsx'
import {PanelLink, PanelReferences} from '../../doc-links.tsx'
import {
	InlineCode,
	PanelHeader,
	PanelList,
	PanelRow,
	PanelSection,
	PanelTableHeader,
	Prose,
} from '../../doc-ui.tsx'

const guardrailsChart = `flowchart LR
  request(["Server fn request"]) -->|"global limit"| mw["rateLimit · per-IP score"]
  mw -->|"over limit"| denied["429"]
  mw -->|"server fn"| auth["verifyAuth"]
  auth -->|"fallback refresh"| refresh["refresh lane · refresh|network"]
  refresh -->|"over limit"| denied
  auth -->|"sign-out"| sout["sign-out lane · sign-out|network"]
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

const threshold = EXCESSIVE_ACTIVITIES_THRESHOLD.toLocaleString('en-US')

type TokenFailureState = Exclude<JwtFailureVerdict, 'hkdf'>

const tokenStateLabels = {
	'expired': 'expired',
	'invalid': 'invalid token',
	'unknown-kid': 'retired key (unknown kid)',
} as const satisfies Record<TokenFailureState, string>

const tokenStateOrder = {
	'invalid': 0,
	'expired': 1,
	'unknown-kid': 2,
} as const satisfies Record<TokenFailureState, number>

const toTokenFailureRows = (
	policies: Record<TokenFailureState, TokenFailurePolicy>,
	omitted: readonly TokenFailureState[] = [],
) => {
	const omittedStates = new Set(omitted)

	// SAFETY: Object.keys widens to string; the record is keyed by the closed
	// TokenFailureState union, so every key it yields is a member.
	const keys = Object.keys(policies) as TokenFailureState[]
	const states = keys.filter((state) => !omittedStates.has(state))

	const rows = states.map((state) => {
		const {failureCause, rateAllowance} = policies[state]

		return {
			state,
			cause: failureCause,
			allowance: rateAllowance,
			weight: allowRatePerWindow(rateAllowance),
		}
	})

	// oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is outside this project's lib target
	rows.sort((a, b) => b.weight - a.weight || tokenStateOrder[a.state] - tokenStateOrder[b.state])

	return rows.map(({state, cause, allowance, weight}) => ({
		state: tokenStateLabels[state],
		cause,
		allowance,
		weight,
	}))
}

const tokenFailureGroups = [
	{label: 'Access JWE', rows: toTokenFailureRows(ACCESS_TOKEN_FAILURES)},
	{label: 'Refresh JWS · refresh entry', rows: toTokenFailureRows(REFRESH_TOKEN_FAILURES)},
	{label: 'Refresh grace · replay', rows: toTokenFailureRows(GRACE_REPLAY_FAILURES, ['expired'])},
	{label: 'Anon JWS', rows: toTokenFailureRows(ANON_TOKEN_FAILURES, ['expired'])},
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
					system fed by logged op outcomes. The limiter rejects bursts; bans reject a subject over a
					longer window.
				</Prose>
				<figure>
					<figcaption className="text-sm font-medium text-muted-foreground">
						Request path
					</figcaption>
					<div className="mt-2 rounded-xl border p-4">
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
					per IP in a 60-second window (<InlineCode>WINDOW_MS</InlineCode> in{' '}
					<InlineCode>src/middleware/rate-limit.ts</InlineCode>). Each request adds{' '}
					<InlineCode>ceil({threshold} / max)</InlineCode> to the IP’s score; the request that
					pushes the score above {threshold} gets a 429. The scoped refresh and sign-out buckets use
					the same formula in their own keys.
				</Prose>
				<PanelList>
					<PanelRow label="createRateLimit(150)">
						The global limiter: 150 requests per minute per IP, set by{' '}
						<InlineCode>createRateLimit(150)</InlineCode> in <InlineCode>src/start.ts</InlineCode>.
					</PanelRow>
					<PanelRow label="rateLimit">
						The auth limiter: 5 requests per minute per IP (<InlineCode>rateLimit</InlineCode> in{' '}
						<InlineCode>src/middleware/rate-limit.ts</InlineCode>). Attach it to sign-up, sign-in,
						and passcode functions. It shares the global key, so a request that passes both limits
						consumes both weights from one budget.
					</PanelRow>
					<PanelRow label="refresh bucket">
						30 fallback refresh attempts per minute per IP (
						<InlineCode>REFRESH_ATTEMPTS_PER_MINUTE</InlineCode> in{' '}
						<InlineCode>src/middleware/verify-auth.ts</InlineCode>). Keyed{' '}
						<InlineCode>refresh|&lt;network&gt;</InlineCode> so it does not spend the global/auth
						score. Checked in <InlineCode>verifyAuth</InlineCode> before the refresh op; a normal
						browser refreshes about once per access-token lifetime. The lane is per-IP and runs
						before the token is verified, so on a shared egress a dead pair retrying at the global
						rate can 429 other clients’ refresh fallback for the rest of the window. Per-session
						keying would need the verification the lane exists to bound.
					</PanelRow>
					<PanelRow label="sign-out bucket">
						30 sign-out requests per minute per IP (
						<InlineCode>SIGN_OUT_ATTEMPTS_PER_MINUTE</InlineCode> in{' '}
						<InlineCode>src/middleware/rate-limit.ts</InlineCode>), keyed{' '}
						<InlineCode>sign-out|&lt;network&gt;</InlineCode>. Both sign-out handlers run the
						refresh nonce check, but sign-out cannot guess a credential and a shared egress can sign
						out several devices at once, so the lane bounds the Argon2 work without spending the
						auth budget. The global limiter remains the outer bound.
					</PanelRow>
					<PanelRow label="storage">
						An in-memory <InlineCode>Map</InlineCode> in the Worker. It is per isolate, not shared
						across instances, and resets on deploy. Treat it as defense in depth, not a global edge
						limit.
					</PanelRow>
					<PanelRow label="stacking">
						The global and auth limiters feed the same per-IP score (
						<InlineCode>addRateLimitEvent</InlineCode> without a scope), so a request that passes
						both consumes both weights. The refresh and sign-out buckets pass a{' '}
						<InlineCode>scope</InlineCode> and use their own keys, so they do not spend that budget.
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
						{ACTIVITIES_BASELINE_WEIGHT} for a successful activity, derived from the threshold ÷ the
						global request limit. A successful action alone never approaches the ban threshold.
					</PanelRow>
					<PanelRow label="passcode sends">
						Each successful passcode request spends an equal share of the threshold (
						<InlineCode>allowRatePerWindow(PASSCODE_SENDS_PER_WINDOW)</InlineCode> in{' '}
						<InlineCode>src/db/ops/auth/strategies/email/request-passcode.ts</InlineCode>), so{' '}
						{PASSCODE_SENDS_PER_WINDOW} sends in one activity window reach it. The weight applies to
						the IP plus the identity on the row; a shared NAT, and on a signed-in send the account
						itself, can be banned. A refusal inside the reset window (
						<InlineCode>resetFromExpiringByEmail</InlineCode> in{' '}
						<InlineCode>src/db/models/email-verifications/queries.ts</InlineCode>) mails nothing,
						carries no weight, and reports <InlineCode>TOO_SOON_SINCE_LAST_RESET</InlineCode>.
					</PanelRow>
					<PanelRow label="credential failure">
						The op’s <InlineCode>rateAllowance</InlineCode> sets the weight. Password and passcode
						ops choose it inline; token entries are tabulated under token failure weights. Wrong
						passwords, unknown emails, and bad codes share one generic message.
					</PanelRow>
					<PanelRow label="rate-limit denial">
						Carries the full {threshold}. A denied attempt is enough to keep the subject banned on
						its own.
					</PanelRow>
					<PanelRow label="defect">
						Zero. A server-side defect is not user behavior and must not feed a ban.
					</PanelRow>
				</PanelList>
				<Prose>
					Activities are append-only. The daily cron archives rows older than{' '}
					{ACTIVITIES_RETENTION_WINDOW} (the default in{' '}
					<InlineCode>src/db/models/activities/consts.ts</InlineCode>), and{' '}
					<InlineCode>archive-old-activities</InlineCode> runs the same path from a VPS.
				</Prose>
			</PanelSection>

			<PanelSection id="abuse-token-failures" title="Token failure weights">
				<Prose>
					Token entries classify the failure before they charge anything. The table below owns the
					verdicts, causes, and weights; the policy maps are the source of truth. The refresh entry
					also charges a wrong nonce (<InlineCode>attemptRotation</InlineCode>,{' '}
					<InlineCode>replayFromGraceToken</InlineCode>) and a future generation (
					<InlineCode>classifySession</InlineCode>); a reuse replay revokes the family (
					<InlineCode>revokeForReuse</InlineCode>), and a missing session is not charged.
				</Prose>
				<div className="overflow-hidden rounded-xl border">
					<table className="w-full text-left">
						<caption className="sr-only">Token failure policy</caption>
						<thead>
							<tr className="border-b">
								<PanelTableHeader scope="col" className="px-5 py-3">
									State
								</PanelTableHeader>
								<PanelTableHeader scope="col" className="px-5 py-3">
									Activity cause
								</PanelTableHeader>
								<PanelTableHeader scope="col" className="px-5 py-3">
									Weight
								</PanelTableHeader>
								<PanelTableHeader scope="col" className="px-5 py-3">
									Allowance
								</PanelTableHeader>
							</tr>
						</thead>
						{tokenFailureGroups.map((group) => (
							<tbody key={group.label}>
								<tr className="border-t">
									<PanelTableHeader colSpan={4} scope="colgroup" className="px-5 py-2">
										{group.label}
									</PanelTableHeader>
								</tr>
								{group.rows.map((row) => (
									<tr key={row.state} className="border-t align-top">
										<th scope="row" className="px-5 py-3 text-left font-normal">
											{row.state}
										</th>
										<td className="px-5 py-3 text-sm">
											<InlineCode>{row.cause}</InlineCode>
										</td>
										<td className="px-5 py-3 text-sm text-muted-foreground tabular-nums">
											{row.weight.toLocaleString('en-US')}
										</td>
										<td className="px-5 py-3 text-sm text-muted-foreground">
											{row.allowance === Infinity ? 'no charge' : `${row.allowance} per ban window`}
										</td>
									</tr>
								))}
							</tbody>
						))}
					</table>
				</div>
				<Prose>
					Allowance is failures per ban window; weight is the threshold divided by allowance,
					rounded up. Anon and grace expired rows are unreachable today and omitted; the policy maps
					still define them. Terminal refresh-token handling never feeds the ban threshold; its
					behavior lives in <PanelLink panel="auth">Auth</PanelLink>.
				</Prose>
			</PanelSection>

			<PanelSection id="abuse-bans" title="Bans">
				<Prose>
					A ban is one temporary block on one scope. Credential ops check the current bans and the
					recent weighted activity before they do any work. An IP, User, or Anon match rejects
					immediately; a failed-credential match follows the known-IP rule below, compared by
					network.
				</Prose>
				<PanelList>
					<PanelRow label="IP_ADDRESS">
						The request IP network, so a client rotating addresses inside its own allocation cannot
						reset the ban. <InlineCode>IP_NETWORK_PREFIX</InlineCode> in{' '}
						<InlineCode>src/db/helpers/ip-network.ts</InlineCode> owns the mask. Applies to every op
						that receives an IP address; the boundary rejects a request without a resolvable client
						IP.
					</PanelRow>
					<PanelRow label="FAILED_CREDENTIAL">
						The email an attempt claimed. Only applied when a User exists and the request comes from
						a new network; a known network can still sign in, so a third party cannot lock the
						account out.
					</PanelRow>
					<PanelRow label="USER">The signed-in User.</PanelRow>
					<PanelRow label="ANON">The anonymous identity.</PanelRow>
					<PanelRow label="ARCHIVED_*">
						The archive twins. Activities and bans follow a retired Anon or User so the history
						still applies.
					</PanelRow>
				</PanelList>
				<Prose>
					The window is {EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL} and the threshold is {threshold} per
					scope (<InlineCode>src/db/models/activities/consts.ts</InlineCode>). A new ban starts at{' '}
					{PENALTY_INTERVAL_INITIAL} when the total weight is exactly at the threshold, grows with
					the accumulated weight, and caps at {PENALTY_INTERVAL_MAX_QTY} {PENALTY_INTERVAL_UNIT} (
					<InlineCode>src/db/models/bans/consts.ts</InlineCode>). A later activity extends only bans
					of its own scope (<InlineCode>implicatesScope</InlineCode> in{' '}
					<InlineCode>logActivityAndHandleBans</InlineCode>), so a denied request cannot compound an
					unrelated ban.
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

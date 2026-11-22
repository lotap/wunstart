/**
 * Policy prose: the table or code owns the details; state the invariant and
 * link. Name the code path behind a behavioral claim.
 * Rules: .agents/skills/wunstart/references/docs.md § Policy prose.
 */
import {ExternalDocLink} from '#/components/global/external-doc-link.tsx'

import {PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'

/** Middleware grouped by where it runs. */
const middlewareLayers = [
	{
		label: 'Request',
		items: [
			{
				name: 'csrfMiddleware',
				description:
					'Server functions only. Rejects a state-changing call without a valid CSRF token.',
			},
			{
				name: 'sanitizeErrors',
				description:
					'Ops errors become 422 responses with their client-safe message. Known server errors pass through; everything else becomes a generic 500 with the cause kept for logs.',
			},
		],
	},
	{
		label: 'Function',
		items: [
			{
				name: 'serverFnNoStore',
				description:
					'Sets Cache-Control: no-store on every server-function response. An endpoint that is genuinely public and cacheable overrides it explicitly and owns the full policy, including Vary; cookies alone do not make a response private.',
			},
			{
				name: 'createRateLimit(150)',
				description:
					'In-memory per-IP limit. The global limiter is installed in src/start.ts; the auth, refresh, and sign-out lanes and their scoring are in Rate limits & bans.',
			},
			{
				name: 'verifyAnon',
				description:
					'Runs verifyAuth, verifies the Anon token, or issues a fresh Anon. Auth and Anon status live on the context.',
			},
			{
				name: 'rejectDegradedAuth',
				description:
					'Returns 503 before the handler runs when identity verification degraded. Handlers never see the degraded state.',
			},
		],
	},
]

/** What identity resolution does for each kind of token result. */
const identityOutcomes = [
	{
		situation: 'Valid access token',
		outcome: 'Authenticated context. The access token is checked without a database round trip.',
	},
	{
		situation: 'Access token missing or invalid, refresh valid',
		outcome: 'The refresh path rotates the session nonce and both token cookies.',
	},
	{
		situation: 'No auth tokens',
		outcome:
			'The Anon token is verified, or a fresh Anon is issued (setAnonCookie in src/middleware/_set-anon-cookie.ts); the Auth panel owns the lifetime.',
	},
	{
		situation: 'AuthTokenError',
		outcome:
			'The token is definitively invalid. Auth cookies are cleared and the request continues as an Anon.',
		mono: true,
	},
	{
		situation: 'RateLimitError',
		outcome: 'Cookies are kept. The request continues as an Anon.',
		mono: true,
	},
	{
		situation: 'Anything else',
		outcome: 'The context is degraded. rejectDegradedAuth returns 503 before the handler runs.',
	},
] satisfies Array<{situation: string; outcome: string; mono?: boolean}>

/** Guards read the verified context; they never re-verify tokens. */
const guards = [
	{
		name: 'requireAuth',
		description: 'Returns 401 when no verified auth context exists.',
	},
	{
		name: 'requireAnon',
		description: 'Returns 400 when the caller is signed in.',
	},
	{
		name: 'requireAnonRegistered',
		description: 'Requires an Anon that already has a database row.',
	},
]

export function MiddlewarePanel() {
	return (
		<>
			<PanelHeader
				title="Middleware & identity"
				description="How every server function resolves who is asking, and what happens when auth cannot be verified."
			/>

			<PanelSection id="middleware-chain" title="The chain">
				<Prose>
					Middleware runs in two passes. Request middleware wraps every request; function middleware
					runs before every server function. The order is deliberate.
				</Prose>
				<div className="grid gap-4 md:grid-cols-2">
					{middlewareLayers.map((layer) => (
						<section
							key={layer.label}
							aria-label={`${layer.label} middleware`}
							className="overflow-hidden rounded-xl border"
						>
							<header className="border-b px-5 py-4">
								<h6 className="text-base font-medium">{layer.label} middleware</h6>
							</header>
							<ul>
								{layer.items.map((item) => (
									<li key={item.name} className="border-t px-5 py-4">
										<code className="font-mono text-sm text-foreground">{item.name}</code>
										<p className="mt-1 text-base leading-relaxed text-muted-foreground">
											{item.description}
										</p>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>

				<Prose>
					Every handler gets the verified context: <InlineCode>ipAddress</InlineCode>,{' '}
					<InlineCode>userAgent</InlineCode>, <InlineCode>country</InlineCode>,{' '}
					<InlineCode>city</InlineCode>, <InlineCode>region</InlineCode>,{' '}
					<InlineCode>timezone</InlineCode>, <InlineCode>auth</InlineCode>, and{' '}
					<InlineCode>anon</InlineCode>.
				</Prose>

				<Prose>
					TanStack Start documents request middleware, function middleware, and{' '}
					<InlineCode>createMiddleware</InlineCode> in its{' '}
					<ExternalDocLink href="https://tanstack.com/start/latest/docs/framework/react/guide/middleware">
						middleware guide
					</ExternalDocLink>
					.
				</Prose>
			</PanelSection>

			<PanelSection id="identity-outcomes" title="Identity outcomes">
				<Prose>
					An outage never looks like an invalid token. That distinction decides whether cookies are
					cleared, kept, or the request is rejected.
				</Prose>
				<PanelList>
					{identityOutcomes.map((item) => (
						<PanelRow
							key={item.situation}
							label={item.situation}
							width="medium"
							labelVariant={item.mono ? 'code' : 'text'}
						>
							{item.outcome}
						</PanelRow>
					))}
				</PanelList>
			</PanelSection>

			<PanelSection id="middleware-guards" title="Guards">
				<Prose>
					Guards read the already-verified context. They do not re-verify tokens or handle the
					degraded state.
				</Prose>
				<PanelList>
					{guards.map((guard) => (
						<PanelRow key={guard.name} label={guard.name}>
							{guard.description}
						</PanelRow>
					))}
				</PanelList>
			</PanelSection>

			<PanelSection id="middleware-ip" title="Client IP">
				<Prose>
					The request boundary reads <InlineCode>cf-connecting-ip</InlineCode>, which Cloudflare
					overwrites, then the runtime socket address. The socket is the client only on a directly
					exposed Node process; behind a local proxy it is the proxy, so a proxied deployment must
					supply its own overwriting header. Production rejects a request with no valid client IP
					instead of inventing one; a per-deployment source setting is deferred.
				</Prose>
				<PanelList>
					<PanelRow label="trusted header">
						Only <InlineCode>cf-connecting-ip</InlineCode> is read. Cloudflare overwrites it at the
						edge; <InlineCode>X-Forwarded-For</InlineCode> and <InlineCode>Forwarded</InlineCode>{' '}
						are ignored because a client can forge them behind a naive proxy.
					</PanelRow>
					<PanelRow label="fallback">
						The runtime socket address when one is exposed. Development falls back to{' '}
						<InlineCode>127.0.0.1</InlineCode>; production returns 503 rather than storing a
						placeholder.
					</PanelRow>
					<PanelRow label="stored address">
						The full address is stored and shown in Settings and security emails. Bans, activities,
						the limiter, and the known-IP check key the address’s network through{' '}
						<InlineCode>ipNetwork</InlineCode> (<InlineCode>IP_NETWORK_PREFIX</InlineCode> in{' '}
						<InlineCode>src/db/helpers/ip-network.ts</InlineCode>), so displayed history stays
						exact.
					</PanelRow>
					<PanelRow label="system ops">
						<InlineCode>0.0.0.0</InlineCode> marks a system operation with no client. It never
						counts as a known IP for the failed-credential bypass and never reaches a user request.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="middleware-cookies" title="Cookies">
				<Prose>
					Auth and Anon cookies are <InlineCode>httpOnly</InlineCode>,{' '}
					<InlineCode>sameSite: &apos;lax&apos;</InlineCode>, scoped to <InlineCode>/</InlineCode>,
					and secure in production. Production defaults to host-only{' '}
					<InlineCode>__Host-Http-</InlineCode> names: the browser requires{' '}
					<InlineCode>Secure</InlineCode>, <InlineCode>HttpOnly</InlineCode>, and{' '}
					<InlineCode>Path=/</InlineCode>, and rejects any <InlineCode>Domain</InlineCode>, so the
					cookie is sent only to the exact host. Issuing an auth session deletes the Anon cookie;
					signing out deletes the auth cookies and issues a fresh Anon.
				</Prose>
				<Prose>
					Set <InlineCode>VITE_COOKIE_DOMAIN</InlineCode> in a production build only to share auth
					across subdomains. Names switch to <InlineCode>__Http-</InlineCode> and the cookie carries
					that <InlineCode>Domain</InlineCode>; every subdomain under it can then set the cookie, so
					keep untrusted content on a different registrable domain. A dedicated auth host with a
					short-lived exchange token avoids the shared cookie. In development, plain names carry a
					per-branch suffix because cookies ignore ports; no domain is needed.
				</Prose>
			</PanelSection>

			<PanelSection id="anon-identity" title="Anon identity">
				<Prose>
					An Anon is a signed JWS in the <InlineCode>anon</InlineCode> cookie carrying{' '}
					<InlineCode>id</InlineCode>, <InlineCode>createdAt</InlineCode>,{' '}
					<InlineCode>iat</InlineCode>, <InlineCode>ipAddresses</InlineCode>, and{' '}
					<InlineCode>registered</InlineCode>. It stays stateless until the first meaningful action,
					then the server materializes an <InlineCode>anons</InlineCode> row and flips{' '}
					<InlineCode>registered</InlineCode>.
				</Prose>
				<Prose>
					<InlineCode>createdAt</InlineCode> is the identity birth and survives;{' '}
					<InlineCode>iat</InlineCode> rotates on issuance. At sign-up the row archives with the new{' '}
					<InlineCode>userId</InlineCode>, and its activities and bans re-point to the archive. Say
					Anon, never Guest.
				</Prose>
			</PanelSection>

			<PanelReferences
				links={[
					{
						label: 'TanStack Start middleware',
						href: 'https://tanstack.com/start/latest/docs/framework/react/guide/middleware',
					},
					{
						label: 'TanStack Start server functions',
						href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-functions',
					},
				]}
			/>
		</>
	)
}

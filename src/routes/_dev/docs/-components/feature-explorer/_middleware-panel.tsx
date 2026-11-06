import {ExternalDocLink} from '#/components/global/external-doc-link.tsx'

import {guards, identityOutcomes, middlewareLayers} from '../../-content/middleware.ts'
import {PanelReferences} from '../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow, PanelSection} from '../doc-ui.tsx'

export function MiddlewarePanel() {
	return (
		<>
			<PanelHeader
				title="Middleware & identity"
				description="How every server function resolves who is asking, and what happens when auth cannot be verified."
			/>

			<PanelSection
				id="middleware-chain"
				title="The chain"
				description="Middleware runs in two passes. Request middleware wraps every request; function middleware runs before every server function. The order is deliberate."
			>
				<div className="grid gap-4 md:grid-cols-2">
					{middlewareLayers.map((layer) => (
						<section
							key={layer.label}
							aria-label={`${layer.label} middleware`}
							className="overflow-hidden rounded-xl border bg-muted/20"
						>
							<header className="bg-muted/30 px-5 py-3">
								<h6 className="text-sm font-medium">{layer.label} middleware</h6>
							</header>
							<ul>
								{layer.items.map((item) => (
									<li key={item.name} className="border-t px-5 py-3">
										<code className="font-mono text-sm text-foreground">{item.name}</code>
										<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
											{item.description}
										</p>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>

				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					Every handler gets the verified context: <InlineCode>ipAddress</InlineCode>,{' '}
					<InlineCode>userAgent</InlineCode>, <InlineCode>country</InlineCode>,{' '}
					<InlineCode>city</InlineCode>, <InlineCode>region</InlineCode>,{' '}
					<InlineCode>timezone</InlineCode>, <InlineCode>auth</InlineCode>, and{' '}
					<InlineCode>anon</InlineCode>.
				</p>

				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					TanStack Start documents request middleware, function middleware, and{' '}
					<InlineCode>createMiddleware</InlineCode> in its{' '}
					<ExternalDocLink href="https://tanstack.com/start/latest/docs/framework/react/guide/middleware">
						middleware guide
					</ExternalDocLink>
					.
				</p>
			</PanelSection>

			<PanelSection
				id="identity-outcomes"
				title="Identity outcomes"
				description="An outage never looks like an invalid token. That distinction decides whether cookies are cleared, kept, or the request is rejected."
			>
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

			<PanelSection
				id="middleware-guards"
				title="Guards"
				description="Guards read the already-verified context. They do not re-verify tokens or handle the degraded state."
			>
				<PanelList>
					{guards.map((guard) => (
						<PanelRow key={guard.name} label={guard.name}>
							{guard.description}
						</PanelRow>
					))}
				</PanelList>
			</PanelSection>

			<PanelSection
				id="middleware-cookies"
				title="Cookies"
				description={
					<>
						Auth and Anon cookies are <InlineCode>httpOnly</InlineCode>,{' '}
						<InlineCode>sameSite: &apos;lax&apos;</InlineCode>, scoped to <InlineCode>/</InlineCode>
						, and secure in production. The domain is <InlineCode>VITE_COOKIE_DOMAIN</InlineCode>;
						production prefixes both names with <InlineCode>__Http-</InlineCode>. Issuing an auth
						session deletes the Anon cookie; signing out deletes the auth cookies and issues a fresh
						Anon.
					</>
				}
			/>

			<PanelSection id="anon-identity" title="Anon identity" childrenClassName="mt-2">
				<p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
					An Anon is a signed JWS in the <InlineCode>anon</InlineCode> cookie carrying{' '}
					<InlineCode>id</InlineCode>, <InlineCode>createdAt</InlineCode>,{' '}
					<InlineCode>iat</InlineCode>, <InlineCode>ipAddresses</InlineCode>, and{' '}
					<InlineCode>registered</InlineCode>. It stays stateless until the first meaningful action,
					then the server materializes an <InlineCode>anons</InlineCode> row and flips{' '}
					<InlineCode>registered</InlineCode>.
				</p>
				<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					<InlineCode>createdAt</InlineCode> is the identity birth and survives;{' '}
					<InlineCode>iat</InlineCode> rotates on issuance. At sign-up the row archives with the new{' '}
					<InlineCode>userId</InlineCode>, and its activities and bans re-point to the archive. Say
					Anon, never Guest.
				</p>
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

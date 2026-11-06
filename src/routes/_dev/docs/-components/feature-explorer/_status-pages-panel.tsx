import {Link} from '@tanstack/react-router'

import {statusPageFiles} from '../../-content/status-pages.ts'
import {PanelReferences} from '../doc-links.tsx'
import {DocLink, InlineCode, PanelHeader, PanelList, PanelRow, PanelSection} from '../doc-ui.tsx'

export function StatusPagesPanel() {
	return (
		<>
			<PanelHeader
				title="Status pages"
				description="Route-level 404 and error pages share one full-viewport frame. Use them for missing routes and failed route loads; keep local query and component failures inside AsyncBoundary or ErrorBoundary."
			/>

			<PanelSection id="status-page-files" title="Files">
				<PanelList>
					{statusPageFiles.map((file) => (
						<PanelRow key={file.name} label={file.name} width="wide" labelSize="xs">
							{file.description}
						</PanelRow>
					))}
				</PanelList>
			</PanelSection>

			<PanelSection id="status-page-behavior" title="Behavior">
				<PanelList>
					<PanelRow label="404" labelVariant="text">
						Unmatched URLs and <InlineCode>notFound()</InlineCode> errors. The server response is
						HTTP 404; the page sets <InlineCode>noindex</InlineCode> and shows the requested path.
						The path is decoded, stripped of control and bidi characters, capped at 96 characters,
						and never includes the query string or hash.
					</PanelRow>
					<PanelRow label="Error" labelVariant="text">
						Route-level failures. An SSR failure returns HTTP 500; the page sets{' '}
						<InlineCode>noindex</InlineCode> and shows the dev-only error message below the actions.{' '}
						<InlineCode>Try again</InlineCode> resets the boundary and invalidates the router.
					</PanelRow>
					<PanelRow label="Audience" labelVariant="text">
						An unmatched 404 resolves as adaptive: external for Anons, internal for signed-in Users.
						A 404 or error thrown inside a matched route keeps that route’s audience.
					</PanelRow>
					<PanelRow label="Scope" labelVariant="text">
						Only route-level failures use the full-page frame. A failed query or component inside a
						route stays local through <InlineCode>AsyncBoundary</InlineCode> or{' '}
						<InlineCode>ErrorBoundary</InlineCode>.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection
				id="status-page-preview"
				title="Preview"
				description={
					<>
						The preview routes live under <InlineCode>_dev</InlineCode> and are excluded from
						production builds.
					</>
				}
			>
				<PanelList>
					<PanelRow
						label={
							// An unmatched path has no route to point Link at; a real anchor exercises the 404.
							<DocLink href="/does-not-exist">/does-not-exist</DocLink>
						}
						labelVariant="plain"
						width="wide"
					>
						Real unmatched URL. Returns HTTP 404 and uses the external footer for Anons.
					</PanelRow>
					<PanelRow
						label={<DocLink render={<Link to="/status-pages" />}>/status-pages</DocLink>}
						labelVariant="plain"
						width="wide"
					>
						Dev hub linking every preview below.
					</PanelRow>
					<PanelRow
						label={
							<DocLink render={<Link to="/status-pages/error" />}>/status-pages/error</DocLink>
						}
						labelVariant="plain"
						width="wide"
					>
						Visual error preview with a sample message.
					</PanelRow>
					<PanelRow
						label={
							<DocLink render={<Link to="/status-pages/throw" />}>/status-pages/throw</DocLink>
						}
						labelVariant="plain"
						width="wide"
					>
						Throws from a route loader and renders the real error boundary with HTTP 500.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelReferences
				links={[
					{
						label: 'TanStack Router not-found errors',
						href: 'https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors',
					},
				]}
			/>
		</>
	)
}

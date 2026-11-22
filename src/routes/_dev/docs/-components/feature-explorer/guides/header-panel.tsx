import {CodeBlock} from '../../code-block.tsx'
import {
	DocBulletList,
	InlineCode,
	PanelHeader,
	PanelList,
	PanelRow,
	PanelSection,
	Prose,
} from '../../doc-ui.tsx'

/** The link config a customizer edits first. */
const linkExample = `export const ANON_LINKS: readonly HeaderLink[] = [
	{to: '/landing-page', label: 'Landing page'},
	{to: '/pricing', label: 'Pricing'},
]

export const USER_LINKS: readonly HeaderLink[] = [
	{to: '/settings', label: 'Settings'},
]`

/** Public repository, or null when the project has none. */
const repoConfigExample = `// src/repo.ts
export const PUBLIC_REPO_URL: string | null = 'https://github.com/you/your-app'`

/** Files that make up the header. */
const headerFiles = [
	{
		name: 'src/components/global/header/header.tsx',
		job: 'Layout, page links, signed-out repo action, theme, auth, and the drawer trigger.',
	},
	{
		name: 'src/components/global/header/_use-bar-pin.ts',
		job: 'Pins the bar to the viewport top when the page scrolls back up and publishes its visible height as --header-dock for fixed or sticky chrome that must sit below it.',
	},
	{
		name: 'src/components/global/header/_links.ts',
		job: 'The signed-out and signed-in link arrays; add routes here.',
	},
	{
		name: 'src/components/global/header/_github-link.tsx',
		job: 'The signed-out repository action: desktop icon and drawer row.',
	},
	{
		name: 'src/components/global/header/_nav-link.tsx',
		job: 'The page-link style shared by the bar and the drawer.',
	},
	{
		name: 'src/components/global/header/_nav-drawer.tsx',
		job: 'The site menu where the bar collapses.',
	},
	{
		name: 'src/components/global/header/_user-nav.tsx',
		job: 'The account dropdown.',
	},
	{
		name: 'src/components/global/header/_account.tsx',
		job: 'The signed-in drawer’s account block and sign out.',
	},
	{
		name: 'src/components/global/header/_settings-shortcuts.ts',
		job: 'The settings shortcuts shared by the dropdown and the drawer.',
	},
	{
		name: 'src/components/global/wordmark.tsx',
		job: 'The inline brand mark; replace its asset to change the logo.',
	},
]

export function HeaderPanel() {
	return (
		<>
			<PanelHeader
				title="Customize the header"
				description="The header is a scaffold: keep the frame, replace the brand and the links."
			/>

			<PanelSection id="header-files" title="Where it lives">
				<PanelList>
					{headerFiles.map((file) => (
						<PanelRow key={file.name} label={file.name} width="wide" labelSize="xs">
							{file.job}
						</PanelRow>
					))}
				</PanelList>
				<Prose>
					The bar leaves the flow while pinned, so the <InlineCode>header</InlineCode> element
					reserves its height. Change both height class lists together.
				</Prose>
			</PanelSection>

			<PanelSection id="header-links" title="Set the links">
				<Prose>
					Add routes to <InlineCode>ANON_LINKS</InlineCode> or <InlineCode>USER_LINKS</InlineCode>{' '}
					in <InlineCode>_links.ts</InlineCode>. The <InlineCode>to</InlineCode> type accepts any
					router path, so a typo fails the typecheck. Replace the starter examples, and keep
					dev-only pages such as <InlineCode>/docs</InlineCode> out of both arrays.
				</Prose>
				<CodeBlock code={linkExample} label="Add a link" language="typescript" />
				<Prose>
					The arrays render in the bar on desktop and collapse into the drawer on narrow screens.
					The link list has limited room, so move the bar’s breakpoint or group the overflow into a
					More menu when it outgrows the bar. The link style lives in{' '}
					<InlineCode>_nav-link.tsx</InlineCode> and applies to both surfaces.
				</Prose>
			</PanelSection>

			<PanelSection id="header-brand" title="Replace the brand">
				<Prose>
					Replace <InlineCode>src/assets/images/brand/wordmark.svg</InlineCode>;{' '}
					<InlineCode>wordmark.tsx</InlineCode> imports it inline. The starter mark uses{' '}
					<InlineCode>currentColor</InlineCode> and evenodd stripes so it can blend in the footer.
				</Prose>
				<DocBulletList>
					<li>
						A replacement SVG keeps its own fills. If it is colored, drop the footer’s{' '}
						<InlineCode>mix-blend-difference</InlineCode> or supply a mono variant.
					</li>
					<li>
						For a raster logo, change the import in <InlineCode>wordmark.tsx</InlineCode> to{' '}
						<InlineCode>?url</InlineCode> and render an <InlineCode>{'<img>'}</InlineCode>, keeping
						the wrapping link’s accessible name.
					</li>
				</DocBulletList>
			</PanelSection>

			<PanelSection id="header-repo" title="Repository link">
				<Prose>
					<InlineCode>PUBLIC_REPO_URL</InlineCode> in <InlineCode>src/repo.ts</InlineCode> drives
					the signed-out header action, the drawer row, the external footer’s Connect column, and
					the license line. Set it to <InlineCode>null</InlineCode> to remove all four; the
					signed-in header and internal footer never show one.
				</Prose>
				<CodeBlock code={repoConfigExample} label="Set the repository" language="typescript" />
			</PanelSection>
		</>
	)
}

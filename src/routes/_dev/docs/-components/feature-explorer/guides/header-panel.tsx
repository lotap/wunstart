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
		job: 'Layout, centered links, signed-out GitHub action, theme, auth, and the menu trigger.',
	},
	{
		name: 'src/components/global/header/_links.ts',
		job: 'Signed-out and signed-in link arrays. Add a route here; the link type validates it.',
	},
	{
		name: 'src/components/global/header/_github-link.tsx',
		job: 'The project’s repo action: signed-out icon on desktop, word plus external mark in the menu.',
	},
	{
		name: 'src/components/global/header/_nav-link.tsx',
		job: 'The one page-link style: type, hover, focus, and active underline.',
	},
	{
		name: 'src/components/global/header/_header-menu.tsx',
		job: 'The menu below md: a full-bleed sheet with page scroll lock, a centered link/utility block, and an anchored auth pair. Carries links, GitHub, theme, and auth.',
	},
	{
		name: 'src/components/global/header/_user-nav.tsx',
		job: 'The account dropdown: profile, settings shortcuts, and sign out.',
	},
	{
		name: 'src/components/global/header/_account.tsx',
		job: 'The signed-in menu’s account block — a “Signed in as” label above the email, the shortcuts, and the anchored Sign out; shares the shortcut data with the dropdown.',
	},
	{
		name: 'src/components/global/wordmark.tsx',
		job: 'The inline wordmark. Replace the SVG or swap the component.',
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
			</PanelSection>

			<PanelSection id="header-links" title="Set the links">
				<Prose>
					Add routes to <InlineCode>_links.ts</InlineCode>. <InlineCode>ANON_LINKS</InlineCode>{' '}
					shows before sign-in; <InlineCode>USER_LINKS</InlineCode> shows after. The link type
					accepts any valid router path, so adding a route is a one-line edit; a typo fails the
					typecheck.
				</Prose>
				<CodeBlock code={linkExample} label="Add a link" language="typescript" />
				<Prose>
					<InlineCode>ANON_LINKS</InlineCode> ships with the landing page and a pricing placeholder
					as examples; replace them with your product’s pages rather than keeping the starter’s
					labels. <InlineCode>USER_LINKS</InlineCode> is empty until your app has signed-in routes.
				</Prose>
				<Prose>
					These arrays are the signed-out and signed-in page hierarchies. A dev-only page such as{' '}
					<InlineCode>/docs</InlineCode> stays out of both; link it from the README or a dev-only
					utility, never from product navigation.
				</Prose>
				<Prose>
					At <InlineCode>md</InlineCode> the arrays render in the bar; below it they collapse into
					the menu. The bar holds about four typical signed-out links before the actions need room;
					the signed-in bar fits more because the account control is narrower. For five or six
					links, move the breakpoint to <InlineCode>lg</InlineCode> or group the overflow into a
					More menu.
				</Prose>
			</PanelSection>

			<PanelSection id="header-repo" title="Repository link">
				<Prose>
					<InlineCode>PUBLIC_REPO_URL</InlineCode> (<InlineCode>src/repo.ts</InlineCode>) is your
					project’s public repository, or <InlineCode>null</InlineCode> when it doesn’t have one. It
					is project config, not app identity. The signed-out header action, the external footer’s
					Connect column, and the license line render only when it is set.
				</Prose>
				<CodeBlock code={repoConfigExample} label="Set the repository" language="typescript" />
				<Prose>
					Point it at your repo to share it; set <InlineCode>null</InlineCode> to remove every
					repository link at once. Nothing else needs editing. The signed-in header and the internal
					footer never show a repository link.
				</Prose>
			</PanelSection>

			<PanelSection id="header-style" title="Choose the voice">
				<Prose>
					<InlineCode>_nav-link.tsx</InlineCode> owns both the desktop list and the menu. The
					default is the theme sans at 14px, 500 in light and 400 in dark, sentence case; below{' '}
					<InlineCode>md</InlineCode> the sheet uses 30px at 52px rows inside a max-w-md column,
					with a 24px pad. The content is one centered block: page links at 30px/52px, a 64px gap,
					then GitHub (with an external mark) and Theme (with its icon) at 16px/44px rows. Signed
					in, the account shortcuts join that group at the same 16px/44px, each with its dropdown
					icon in a 16px column on the 24px rail. Sign in is a ghost row and Sign up a stock 56px
					default button, split by 12px and anchored at the bottom; signed in, a ghost Sign out
					takes the slot. There is no divider or custom CTA. The active route keeps the 2px
					underline in both the bar and the menu. Change that one file to change every nav item.
				</Prose>
				<DocBulletList>
					<li>
						For the mono-caps variant, swap the base classes for{' '}
						<InlineCode>font-mono text-xs tracking-[0.12em] uppercase</InlineCode>.
					</li>
					<li>
						Hover is the text color alone: no row fill. The rows inset 8px into the gutter so the
						focus ring sits clear of the label, while labels stay on the 24px line.
					</li>
					<li>
						The wordmark is the one fixed brand artifact. Replace the SVG in{' '}
						<InlineCode>wordmark.tsx</InlineCode>; keep the wrapping link’s accessible name.
					</li>
				</DocBulletList>
			</PanelSection>

			<PanelSection id="header-behavior" title="Choose alignment and behavior">
				<Prose>
					The bar is a three-slot grid: brand, links, actions. The links list is centered by
					default; switch <InlineCode>justify-self-center</InlineCode> to{' '}
					<InlineCode>justify-self-start</InlineCode> or <InlineCode>justify-self-end</InlineCode>{' '}
					to move the group without changing the DOM. Centering keeps the group balanced as links
					are added; the other two read as a denser cluster against the brand or the actions.
				</Prose>
				<Prose>
					The header is static by default, on the same <InlineCode>max-w-5xl</InlineCode> grid as
					the page, with the page background and a 1px bottom border. Sticky is opt-in: add{' '}
					<InlineCode>sticky top-0</InlineCode> and a background in{' '}
					<InlineCode>header.tsx</InlineCode>. If the landing page’s section dock is still mounted,
					offset its docked position to the header height so the two fixed layers do not compete.
				</Prose>
				<Prose>
					The plain border is the scaffold default because it survives a re-skin. For the gallery’s
					tinted, floating, or capsule bars, keep the frame and change the surface: remove{' '}
					<InlineCode>border-b</InlineCode> and either add a surface token or wrap the nav in a
					rounded container with <InlineCode>ring-1</InlineCode> and a shadow. Those are brand
					decisions; the default stays neutral.
				</Prose>
			</PanelSection>

			<PanelSection id="header-scope" title="Header and page">
				<Prose>
					The header is defined by the signed-in state, not by the page’s audience. Its height is
					constant: 64px desktop, 56px mobile. Marketing, docs, and app pages share the same global
					frame; page-level navigation belongs to the page. The wordmark is not a heading: each page
					owns its <InlineCode>h1</InlineCode>. The footer still receives the resolved audience
					because it is page-attached and revealed at the end.
				</Prose>
			</PanelSection>

			<PanelSection id="header-actions" title="Utilities and account">
				<Prose>
					At <InlineCode>md</InlineCode> and up the bar holds the utilities: the signed-out repo
					icon, theme, a divider, then Sign in / Sign up (or the account avatar). Below{' '}
					<InlineCode>md</InlineCode> those controls move into the menu, and the bar keeps only the
					brand and the trigger. The menu always has the Theme control, so the trigger always exists
					below <InlineCode>md</InlineCode>; there is no empty menu. Sign out lives in the account
					dropdown at <InlineCode>md</InlineCode> and up, and in the menu below it.
				</Prose>
			</PanelSection>

			<PanelSection id="header-menu" title="The collapsed menu">
				<Prose>
					Below <InlineCode>md</InlineCode> the bar keeps only the brand and the trigger; the menu
					carries page links, the signed-out GitHub action, theme, and Sign in / Sign up, or the
					signed-in account block. Below <InlineCode>md</InlineCode> the menu is one full-bleed
					sheet under the header: page scroll locks, the page behind is inert, and the sheet scrolls
					as one centered block above the anchored action. Its height is the viewport minus the bar,
					measured from the nav, so it ends at the viewport edge at any header height. The block is
					a max-w-md column: page links at 30px/52px, a 64px gap, then GitHub (with an external
					mark) and Theme (with its icon) at 16px/44px rows. Signed in, the group opens with the
					account: a muted “Signed in as” label, the profile email on its own line beneath it
					(truncating when long), then Preferences, Profile, and Access &amp; Security with the same
					icons as the dropdown, in a 16px column on the 24px rail, with Theme last. Sign in is a
					ghost row and Sign up a stock 56px default button, split by 12px and anchored at the
					bottom; signed in, a single ghost Sign out takes that slot. There is no divider or custom
					CTA. The labeled Theme control is itself the toggle. The trigger always renders below{' '}
					<InlineCode>md</InlineCode>; the Theme control guarantees the menu is never empty. The
					sheet closes on navigation, resize, outside press, and Escape, and Escape returns focus to
					the trigger; internal scrolling does not dismiss it. That dismissal behavior is shared
					with the landing page’s section dock.
				</Prose>
			</PanelSection>
		</>
	)
}

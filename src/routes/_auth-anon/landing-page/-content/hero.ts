/** Words that cycle through the hero headline slot. */
export const HERO_WORDS = ['idea', 'product', 'dashboard', 'side-hustle', 'vision'] as const

/** Words that follow the headline in the features subline. */
export const HERO_SUBLINE_WORDS = ['with', 'the', 'features', 'you', 'need'] as const

/** Feature cards that rise through the hero after the subline lands. */
export const HERO_FEATURES = [
	'Auth',
	'Analytics',
	'Feature flags',
	'Image optimization',
	'Bot protection',
	'Payment processing',
	'Agentic integrations',
] as const

type HeroSectionLink = {
	label: string
	href: string
	emphasis?: boolean
}

/** Section links shown in the hero navigation. */
export const HERO_SECTION_LINKS: ReadonlyArray<HeroSectionLink> = [
	{label: 'Batteries included', href: '#features'},
	{label: 'Extendable', href: '#extensible'},
	{label: 'Rot-resistant', href: '#primitives'},
	{label: 'Trusted stack', href: '#stack'},
	{label: 'Portable', href: '#portability'},
	{label: 'Get started', href: '#get-started', emphasis: true},
]

/** Section ids in the order they appear on the page. */
export const HERO_SECTION_IDS = HERO_SECTION_LINKS.map((link) => link.href.slice(1))

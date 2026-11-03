import type {IconType} from '@icons-pack/react-simple-icons'
import {SiClaudecode, SiOpencode, SiPi} from '@icons-pack/react-simple-icons'

export type InstallTab = 'agent' | 'manual'

/** Prompt offered for copying into an agent harness. */
export const startPrompt =
	'Start a new project with wunstart: https://github.com/lotap/wunstart. Follow the “For agents” setup in the README, then ask me what I want to build and propose the smallest end-to-end slice.'

/** Install methods offered in the manual tab. */
export const installMethods = ['bun', 'npm', 'pnpm', 'git'] as const

type InstallMethod = (typeof installMethods)[number]

/** Shell commands for each install method. */
export const installCommands: Record<InstallMethod, string> = {
	bun: `bunx degit github:lotap/wunstart my-app
cd my-app
git init -b trunk
bun run app-identity
bun run install-deps
bun run branch-env
bun run dev`,
	npm: `npx degit github:lotap/wunstart my-app
cd my-app
git init -b trunk
npm run app-identity
npm run install-deps
npm run branch-env
npm run dev`,
	pnpm: `pnpm dlx degit github:lotap/wunstart my-app
cd my-app
git init -b trunk
pnpm run app-identity
pnpm run install-deps
pnpm run branch-env
pnpm run dev`,
	git: `git clone https://github.com/lotap/wunstart my-app
cd my-app
rm -rf .git && git init -b trunk
bun run app-identity
bun run install-deps
bun run branch-env
bun run dev`,
}

/** Agent harnesses linked from the CTA. A missing icon renders a dashed tile. */
export const harnesses: ReadonlyArray<{name: string; href: string; icon?: IconType}> = [
	{name: 'OpenCode', href: 'https://opencode.ai', icon: SiOpencode},
	{name: 'Claude Code', href: 'https://claude.com/product/claude-code', icon: SiClaudecode},
	{name: 'Codex', href: 'https://openai.com/codex/'},
	{name: 'Pi Agent', href: 'https://pi.dev/', icon: SiPi},
]

/** Closing tagline, split so each line can be animated separately. */
export const taglineLines: ReadonlyArray<{text: string; emphasis?: boolean; muted?: boolean}> = [
	{text: 'Build'},
	{text: 'for'},
	{text: 'humans', emphasis: true},
	{text: 'with', muted: true},
	{text: 'agents', muted: true},
]

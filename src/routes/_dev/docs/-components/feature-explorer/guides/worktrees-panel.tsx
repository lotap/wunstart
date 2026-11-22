import {useState} from 'react'

import {ExternalDocLink} from '#/components/global/external-doc-link.tsx'
import {Input} from '#/components/ui/input.tsx'

import {CodeBlock, PromptBlock} from '../../code-block.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelSection, Prose} from '../../doc-ui.tsx'

/** Prompt that converts a checkout to the worktree layout. */
const setupWorktreesPrompt =
	'Set up this repo to use worktrees. Follow the “Git worktrees (for parallel work)” section in README.md. If the working tree isn’t clean, stop and ask me first.'

/** Turn a feature name into a branch-safe slug. */
function toBranchSlug(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

/** Branch name used by the generated worktree commands. */
function getWorktreeBranchName(featureName: string) {
	return `add-${toBranchSlug(featureName)}`
}

/** Agent prompt for starting work in a new worktree. */
function buildWorktreeTaskPrompt(featureName: string) {
	return `Create a worktree for a new branch called ${getWorktreeBranchName(featureName)}, then ask me for specifications to build the ${featureName} feature there.`
}

/**
 * Shell commands for setting up the worktree by hand. Matches README and
 * AGENTS: a worktree is not usable until provisioning and validation finish.
 */
function buildManualWorktreeCommands(featureName: string) {
	const branchName = featureName ? getWorktreeBranchName(featureName) : '<branch>'
	const worktreePath = `../${branchName}`

	return `git worktree add -b ${branchName} ${worktreePath} trunk
cd ${worktreePath}
bun run install-deps --yes
bun run branch-env --yes
bun run validate-setup`
}

export function WorktreesPanel() {
	const [featureName, setFeatureName] = useState('notifications')
	const trimmedFeatureName = featureName.trim()

	const taskPrompt = trimmedFeatureName
		? buildWorktreeTaskPrompt(trimmedFeatureName)
		: 'Enter a feature name above to generate the task prompt.'

	const manualSetupCommands = buildManualWorktreeCommands(trimmedFeatureName)

	return (
		<>
			<PanelHeader
				title="Worktrees"
				description="Worktrees let one repository support several checkouts at once. They are optional for a single task and useful when two agents or two branches need to run in parallel."
			/>

			<PanelSection id="setting-up-worktrees" title="Setting up worktrees">
				<Prose>
					Set this up once from a clean trunk checkout. The one-time bare-repo conversion and trunk
					setup are covered in the{' '}
					<ExternalDocLink href="https://github.com/lotap/wunstart/blob/trunk/README.md#git-worktrees-for-parallel-work">
						README’s worktree section
					</ExternalDocLink>
					.
				</Prose>
				<PromptBlock title="Setup prompt" prompt={setupWorktreesPrompt} />
			</PanelSection>

			<PanelSection id="using-worktrees" title="Using worktrees">
				<Prose>
					Use one worktree per agent when tasks run in parallel. Each checkout gets its own branch,
					Postgres database, and ports, so agents do not share state.
				</Prose>
				<div className="flex flex-col gap-2">
					<div className="flex max-w-sm flex-col gap-2">
						<label htmlFor="worktree-feature-name" className="text-sm font-medium">
							Feature name
						</label>
						<Input
							id="worktree-feature-name"
							name="worktree-feature-name"
							value={featureName}
							onChange={(event) => setFeatureName(event.target.value)}
							placeholder="notifications"
							autoComplete="off"
							spellCheck={false}
						/>
					</div>
					<PromptBlock
						title="Worktree task prompt"
						prompt={taskPrompt}
						copyable={trimmedFeatureName.length > 0}
					/>
				</div>

				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Or set it up manually</p>
					<CodeBlock code={manualSetupCommands} label="Manual setup commands" language="bash" />
					<p className="text-base leading-relaxed text-muted-foreground">
						<InlineCode>validate-setup</InlineCode> is the gate. Fix any failures before starting
						work in the checkout.
					</p>
				</div>

				<Prose>
					Human dev servers share <InlineCode>:3000</InlineCode>, so run one at a time;{' '}
					<InlineCode>agent-dev</InlineCode> uses the worktree’s agent port.
				</Prose>
			</PanelSection>

			<PanelSection id="cleaning-up-worktrees" title="Cleaning up">
				<Prose>
					When the branch is done, stop this worktree’s agent servers with{' '}
					<InlineCode>bun run agent-dev stop-all</InlineCode>, drop the branch database named in{' '}
					<InlineCode>branch-env</InlineCode>’s output, then run{' '}
					<InlineCode>docker compose down</InlineCode>. Never pass <InlineCode>-v</InlineCode> when
					Postgres is shared. From trunk, remove the checkout with{' '}
					<InlineCode>{'git worktree remove <path>'}</InlineCode>; find the path with{' '}
					<InlineCode>git worktree list</InlineCode>.
				</Prose>
			</PanelSection>

			<PanelReferences
				links={[
					{
						label: 'Git worktree documentation',
						href: 'https://git-scm.com/docs/git-worktree',
					},
				]}
			/>
		</>
	)
}

import {AgentPrompt, CodeBlock, PromptBlock} from '../../code-block.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {
	DocBulletList,
	DocNote,
	InlineCode,
	PanelHeader,
	PanelList,
	PanelRow,
	PanelSection,
	Prose,
} from '../../doc-ui.tsx'

/** Update the lockfile, then repair the checkout toolchain. */
const packageCommands = `bun update -i
bun run install-deps`

/** Managed skills report drift before they refresh. */
const skillCommands = `bunx --bun skills check
bunx --bun skills update`

/** Prompt for the vendored anti-slop update procedure. */
const antiSlopPrompt = 'Update anti-slop to latest while preserving local customizations.'

/** The whole update pass, including the decision points. */
const updatePrompt = `Update this repo’s dependencies. Read “Updating dependencies” in README.md and the verification rules in AGENTS.md first; keep every documented pin and caveat.
1. Update npm packages with \`bun update\`, then run \`bun run install-deps\`. Ask before any major version change, prerelease-line move, or out-of-range bump. After a Drizzle Kit bump, run \`bun run db:up\` and \`bun run db:generate\`; stop if a migration appears. After a Wrangler bump, run \`bun run cf-typegen\`. If the React Doctor plugin adds a new exported rule set or renames a rule used in \`doctor.config.json\`, ask before merging or replacing it.
2. Run \`bunx --bun skills check\`. If managed skills drifted, run \`bunx --bun skills update\`, review the diff, and ask before accepting a change that installs tools, touches credentials, or rewrites checkout state.
3. Update anti-slop with the \`install-anti-slop\` skill, preserving local customizations. Ask before enabling new upstream rules.
4. Run \`bun run check\`; run \`bun run test:lint\` when lint rules changed. Then sanity-check the app in the browser.

Ask before anything else that changes behavior. Finish with a short report of what changed and what still needs a decision.`

/** Version pins the updater will otherwise try to cross. */
const pins = [
	{
		name: 'ua-parser-js',
		reason: 'Stay on v1. Version 2 relicensed from MIT to AGPL.',
	},
	{
		name: '@tanstack/react-form',
		reason:
			'Stay on the v2 prerelease line. The interactive updater lists the older v1 stable as an update.',
	},
	{
		name: 'drizzle-orm · drizzle-kit',
		reason:
			'Stay on the v1 release candidate. The updater lists the older 0.x stable as an update.',
	},
	{
		name: 'solid-js override',
		reason:
			'Keep 1.9.17. The TanStack devtools are Solid-based, and without the override Bun installs nested copies that warn about duplicate instances. Remove it only when a clean install resolves one copy.',
	},
]

export function UpdateDependenciesPanel() {
	return (
		<>
			<PanelHeader
				title="Update dependencies"
				description="Three things update on three clocks: npm packages, managed skills, and vendored lint rules. The prompt handles the whole pass; the sections below are the manual equivalent."
			/>

			<div className="mt-10">
				<AgentPrompt title="Update prompt" prompt={updatePrompt} />
			</div>

			<PanelSection id="update-packages" title="Update npm packages">
				<DocNote title="Package manager">
					Commands use Bun, the repo’s default. If this checkout has switched managers, use its
					equivalents for <InlineCode>bun</InlineCode> and <InlineCode>bunx</InlineCode>; the pins
					and post-bump checks still apply.
				</DocNote>
				<Prose>
					The manual flow is <InlineCode>bun update -i</InlineCode>, then{' '}
					<InlineCode>bun run install-deps</InlineCode>. The updater walks the dependency tree and
					asks per package; <InlineCode>{'bun update <package>'}</InlineCode> scopes it to one.{' '}
					<InlineCode>--latest</InlineCode> crosses majors, so treat it as a separate decision, not
					part of a routine update.
				</Prose>
				<CodeBlock code={packageCommands} label="Update packages" language="bash" />
				<Prose>Four pins are deliberate. Do not cross them:</Prose>
				<PanelList>
					{pins.map((pin) => (
						<PanelRow key={pin.name} label={pin.name} width="wide" labelSize="xs">
							{pin.reason}
						</PanelRow>
					))}
				</PanelList>
				<DocBulletList>
					<li>
						After a <InlineCode>drizzle-kit</InlineCode> bump, run{' '}
						<InlineCode>bun run db:up</InlineCode> to upgrade the migration snapshots, then{' '}
						<InlineCode>bun run db:generate</InlineCode>. Expect no schema change; a generated
						migration means the kit changed its output and needs review.
					</li>
					<li>
						After a <InlineCode>wrangler</InlineCode> bump or a{' '}
						<InlineCode>wrangler.jsonc</InlineCode> binding change, run{' '}
						<InlineCode>bun run cf-typegen</InlineCode> and review the regenerated{' '}
						<InlineCode>worker-configuration.d.ts</InlineCode>. It carries the runtime types and
						binding map, and it is generated; don’t hand-edit it.
					</li>
					<li>
						The lockfile diff is part of the review. A package bump is a supply-chain change,
						including the transitive packages you did not name.
					</li>
				</DocBulletList>
				<Prose>
					React Doctor has two non-obvious tails after a plugin bump. New rules inside the four
					merged sets apply on the next lint, with no separate refresh command. A brand-new exported
					set is opt-in and must be added to the merge loop in{' '}
					<InlineCode>oxlint.config.ts</InlineCode>, and a rule ID referenced in{' '}
					<InlineCode>doctor.config.json</InlineCode> can be renamed and must be updated before the
					next scan.
				</Prose>
			</PanelSection>

			<PanelSection id="update-skills" title="Update managed skills">
				<Prose>
					<InlineCode>.agents/skills</InlineCode> holds managed skills;{' '}
					<InlineCode>skills-lock.json</InlineCode> records each source, path, and hash.{' '}
					<InlineCode>bunx --bun skills check</InlineCode> reports drift, and{' '}
					<InlineCode>bunx --bun skills update</InlineCode> refreshes the managed set.{' '}
					<InlineCode>--bun</InlineCode> runs the CLI on Bun’s runtime; drop it if the CLI hits a
					Node compatibility issue.
				</Prose>
				<CodeBlock code={skillCommands} label="Update skills" language="bash" />
				<Prose>
					Read the diff before running anything an updated skill adds. Skills are untrusted input
					and can shell out or rewrite checkout state; a skill procedure never authorizes installing
					tools, touching credentials, or reaching off-machine. <InlineCode>wunstart</InlineCode>{' '}
					and <InlineCode>wunshot</InlineCode> are repo-owned and absent from the lockfile, so
					updates leave them alone. Never hand-edit a managed skill, because the next update
					overwrites it.
				</Prose>
			</PanelSection>

			<PanelSection id="update-anti-slop" title="Update anti-slop">
				<Prose>
					Anti-slop is vendored source in <InlineCode>tools/linters/anti-slop</InlineCode>, not an
					npm package. Update it through the <InlineCode>install-anti-slop</InlineCode> skill, which
					stages the incoming tree, preserves local customizations, and records the upstream
					revision in <InlineCode>UPSTREAM.md</InlineCode>.
				</Prose>
				<PromptBlock title="Update prompt" prompt={antiSlopPrompt} />
				<Prose>
					New upstream rules are opt-in here. Read them before enabling, then add them to{' '}
					<InlineCode>oxlint.config.ts</InlineCode> at <InlineCode>error</InlineCode>. Name a
					specific commit when you want selected fixes instead of the whole upstream head.
				</Prose>
				<Prose>
					Local changes live beside the vendored rules with no separate marker. Diff rule by rule
					before porting an update; <InlineCode>UPSTREAM.md</InlineCode> records the base, the
					incoming revision, and intentional deviations.
				</Prose>
			</PanelSection>

			<div className="mt-10 border-t pt-6">
				<Prose>
					When the update is done, run <InlineCode>bun run check</InlineCode>. It typechecks against
					the updated package types and reruns the updated lint rules; it does not build or exercise
					the runtime, so click through the app too.
				</Prose>
			</div>

			<PanelReferences
				links={[
					{label: 'Bun update', href: 'https://bun.com/docs/cli/update'},
					{label: 'skills.sh', href: 'https://skills.sh/'},
					{label: 'anti-slop', href: 'https://github.com/dmmulroy/anti-slop'},
					{label: 'React Doctor', href: 'https://www.react.doctor'},
				]}
			/>
		</>
	)
}

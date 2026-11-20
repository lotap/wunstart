import {AgentPrompt, CodeBlock, PromptBlock} from '../../code-block.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {
	DocNote,
	InlineCode,
	PanelHeader,
	PanelList,
	PanelRow,
	PanelSection,
	Prose,
} from '../../doc-ui.tsx'

/** Check a branch end to end, including the judgment calls. */
const checkPrompt = `Check this branch’s React changes with React Doctor.
1. Run \`npx react-doctor@latest --verbose --scope changed\` and \`bun run lint\`.
2. Read each React Doctor rule with \`rules explain\` before editing. Fix the cause instead of suppressing it.
3. Re-run the branch scan and \`bun run check\` after the fixes, then check the affected interaction in the browser.

Keep the existing exceptions in \`oxlint.config.ts\` and \`doctor.config.json\`; ask before changing behavior or adding a suppression. Finish with a short report of what changed and what still needs a decision.`

/** The three checks, in the order a change moves through them. */
const checkCommands = `# Fast loop while editing
bun run lint

# Only what this branch introduced
npx react-doctor@latest --verbose --scope changed

# Repo gate before committing
bun run check`

/** Read the rule, then ask why this line fired. */
const explainCommands = `# Why the rule matters, and its fix recipe
npx react-doctor@latest rules explain react-doctor/no-derived-state-effect

# Why this line fired, or why a suppression did not apply
npx react-doctor@latest why src/components/global/header/header.tsx:42`

/** Re-run the surface that reported the finding, then the gate. */
const verifyCommands = `# The file, through the repo’s Oxlint config
bunx oxlint src/components/global/header/header.tsx

# The branch check again
npx react-doctor@latest --scope changed

# Format, lint, Tailwind, types, and DB checks
bun run check`

/** A deliberate exception carries its reason on the same line. */
const suppressionExample = '// oxlint-disable-next-line react-doctor/no-array-index-as-key -- fixed'

/** Full-tree evidence for an audit. */
const scanCommands = 'npx react-doctor@latest --json --json-out .tmp/react-doctor-report.json'

/** Ask for a prioritized audit instead of a file-level fix. */
const auditPrompt =
	'Use the improve-react skill on this repo. Scan with --json --json-out .tmp/react-doctor-report.json, vet findings by user impact, and write plans for the top fixes. Treat existing exceptions in oxlint.config.ts and doctor.config.json as decisions.'

export function UnslopReactPanel() {
	return (
		<>
			<PanelHeader
				title="Unslop React"
				description="Check React changes with the repo’s lint stack and React Doctor. The prompt handles the pass; the sections below are the manual equivalent."
			/>

			<div className="mt-10">
				<AgentPrompt title="React check prompt" prompt={checkPrompt} />
			</div>

			<PanelSection id="unslop-when" title="When to run this">
				<PanelList>
					<PanelRow label="While editing" labelVariant="text">
						<InlineCode>bun run lint</InlineCode> is the fast per-file loop. Warnings do not fail.
					</PanelRow>
					<PanelRow label="Before review" labelVariant="text">
						<InlineCode>npx react-doctor@latest --verbose --scope changed</InlineCode> reports only
						diagnostics this branch introduced.
					</PanelRow>
					<PanelRow label="Before commit" labelVariant="text">
						<InlineCode>bun run check</InlineCode> is the full gate. Warnings fail.
					</PanelRow>
					<PanelRow label="Whole tree or roadmap" labelVariant="text">
						<InlineCode>npx react-doctor@latest --json --json-out .tmp/...</InlineCode> collects
						evidence for an <InlineCode>improve-react</InlineCode> audit.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="unslop-check" title="Check the change">
				<Prose>The manual flow is three commands:</Prose>
				<CodeBlock code={checkCommands} label="Check the change" language="bash" />
				<Prose>
					<InlineCode>--scope changed</InlineCode> compares against the branch base and reports only
					diagnostics this branch introduced. Pass <InlineCode>--base &lt;ref&gt;</InlineCode> when
					the auto-detected base is wrong.
				</Prose>
				<Prose>
					The CLI also runs project rules, <InlineCode>deslop/*</InlineCode>,{' '}
					<InlineCode>socket/*</InlineCode>, and security scans, which{' '}
					<InlineCode>bun run lint</InlineCode> cannot. A clean lint is not a clean scan.
				</Prose>
			</PanelSection>

			<PanelSection id="unslop-fix" title="Fix a finding">
				<Prose>
					Each React Doctor finding names a rule and a location. Read the rule before editing; its
					fix recipe is authoritative.
				</Prose>
				<CodeBlock code={explainCommands} label="Read the finding" language="bash" />
				<Prose>
					Fix the cause: remove the effect, state, wrapper, or unstable key. Don’t move the pattern
					behind a helper or suppress a warning you haven’t read.
				</Prose>
				<CodeBlock code={verifyCommands} label="Re-check the fix" language="bash" />
				<Prose>
					If the change affects behavior, check it in the browser. The scan is static; it does not
					prove the interaction works.
				</Prose>
			</PanelSection>

			<PanelSection id="unslop-exception" title="Keep an exception narrow">
				<Prose>
					When the pattern is deliberate, suppress the narrowest line and leave the reason after{' '}
					<InlineCode>--</InlineCode>. A fixed list can use its index as a key:
				</Prose>
				<CodeBlock code={suppressionExample} label="Reasoned suppression" language="tsx" />
				<Prose>
					That comment clears both <InlineCode>bun run lint</InlineCode> and the CLI for per-file
					rules, because the CLI runs Oxlint with the repo config. A CLI-only finding needs{' '}
					<InlineCode>react-doctor-disable-next-line</InlineCode> or an entry in{' '}
					<InlineCode>doctor.config.json</InlineCode>.
				</Prose>
				<Prose>
					Copy the rule ID from the surface that reported it: the CLI uses{' '}
					<InlineCode>deslop/*</InlineCode> for project rules, while Oxlint uses{' '}
					<InlineCode>react-doctor/*</InlineCode>.
				</Prose>
				<Prose>
					For a path-wide exception, use <InlineCode>doctor.config.json</InlineCode>; use{' '}
					<InlineCode>oxlint.config.ts</InlineCode> for severity and which paths the rules run on.
				</Prose>
				<DocNote variant="warning" title="Never edit generated UI">
					<InlineCode>src/components/ui/**</InlineCode> is generated. Fix the finding at the caller
					with <InlineCode>cn()</InlineCode>; do not patch the generated file or add a suppression
					there.
				</DocNote>
			</PanelSection>

			<PanelSection id="unslop-audit" title="Full scan and audit">
				<Prose>
					Use the full scan when the branch check is not enough and you need evidence for the whole
					tree:
				</Prose>
				<CodeBlock code={scanCommands} label="Full scan" language="bash" />
				<Prose>
					Write the report to <InlineCode>.tmp/</InlineCode>;{' '}
					<InlineCode>bun run clean:tmp</InlineCode> wipes it. Never commit it.
				</Prose>
				<Prose>
					For a prioritized roadmap, use the <InlineCode>improve-react</InlineCode> skill. It scans
					read-only, vets findings by impact, and writes self-contained plans under{' '}
					<InlineCode>plans/</InlineCode>; it does not edit source.
				</Prose>
				<PromptBlock title="Audit prompt" prompt={auditPrompt} />
				<Prose>
					After executing a plan, re-run <InlineCode>--scope changed</InlineCode> and{' '}
					<InlineCode>bun run check</InlineCode>, then check the interaction in the browser.
				</Prose>
			</PanelSection>

			<PanelReferences
				links={[
					{label: 'React Doctor', href: 'https://www.react.doctor'},
					{label: 'React Doctor docs', href: 'https://www.react.doctor/docs'},
					{label: 'React Compiler', href: 'https://react.dev/learn/react-compiler'},
					{
						label: 'You might not need an effect',
						href: 'https://react.dev/learn/you-might-not-need-an-effect',
					},
				]}
			/>
		</>
	)
}

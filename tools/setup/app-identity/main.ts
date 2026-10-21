// Project-level identity setup: resolve the app name and description,
// validate the committed project shape, and synchronize package.json,
// wrangler.jsonc, src/app-info.ts, and public/llms.txt. Stateless by
// design: every run derives its target from flags and the files themselves.

import {basename, join} from 'node:path'
import process from 'node:process'

import {isValidSlug} from '../../helpers/app-name.ts'
import {fail, isQuietMode, ok, step, warn} from '../../helpers/output.ts'
import {detectPm, phaseCommand} from '../../helpers/package-manager.ts'
import {ROOT} from '../../helpers/paths.ts'
import {wasmState} from '../../helpers/project-files.ts'
import type {Asker} from '../../helpers/prompt.ts'
import {confirmValidator, isDeclined} from '../../helpers/prompt.ts'
import {loadEnvFile, validateEnvVars} from '../../helpers/required-env.ts'
import {runEntry, resumeHint, setupPhase} from '../../helpers/run-phase.ts'
import type {CliConfig} from './cli.ts'
import {checkDescription, parseCliArgs} from './cli.ts'
import type {IdentitySnapshot, IdentityTarget} from './identity.ts'
import {applyIdentity, identityValues, readIdentitySnapshot} from './identity.ts'

type NameInputs = {
	cliName: string | undefined
	skipRename: boolean
	canPrompt: boolean
	ask: Asker['ask']
	currentName: string
	dirName: string
	rerun: string
}

async function resolveName(inputs: NameInputs): Promise<string> {
	const {cliName, skipRename, canPrompt, ask, currentName, dirName, rerun} = inputs
	if (skipRename) {
		warn('skipping rename (--skip-rename)')
		if (cliName !== undefined) {
			warn(`ignoring app name '${cliName}' (--skip-rename wins)`)
		}
		const problem: string | null = currentName === '' ? 'no app name' : isValidSlug(currentName)
		if (problem !== null) {
			fail(
				`cannot keep the current app name: ${problem}`,
				`drop --skip-rename and pass a valid name: ${rerun} my-app`,
			)
		}
		return currentName
	}
	if (cliName !== undefined) {
		return cliName
	}
	const defaultName: string =
		currentName !== '' && isValidSlug(currentName) === null ? currentName : dirName
	if (canPrompt) {
		return ask('App name (lowercase letters, digits, hyphens; empty takes the default)', {
			defaultValue: defaultName,
			validate: (value: string) => (value === '' ? null : isValidSlug(value)),
		})
	}
	if (currentName === '') {
		fail('no app name found', `pass one: ${rerun} my-app`)
	}
	const problem: string | null = isValidSlug(currentName)
	if (problem !== null) {
		fail(`current app name '${currentName}' is not valid`, `pass a valid one: ${rerun} my-app`)
	}
	return currentName
}

type DescriptionInputs = {
	cliDescription: string | null
	canPrompt: boolean
	ask: Asker['ask']
	currentDescription: string
	rerun: string
}

async function resolveDescription(inputs: DescriptionInputs): Promise<string> {
	const {cliDescription, canPrompt, ask, currentDescription, rerun} = inputs
	if (cliDescription !== null) {
		return cliDescription
	}
	if (canPrompt) {
		return checkDescription(
			await ask('One-line app description (empty keeps it unchanged)', {
				defaultValue: currentDescription,
				validate: (value: string) =>
					/[\n\r\v\f\u2028\u2029]/.test(value) ? 'use a single line with no line breaks' : null,
			}),
			'description entry',
			1,
			`use one line, or pass one: ${rerun} --description "one line"`,
		)
	}
	return checkDescription(
		currentDescription,
		'current app description',
		1,
		`fix it in package.json or src/app-info.ts, or pass one: ${rerun} --description "one line"`,
	)
}

function checkProjectFiles(): void {
	const envPath: string = join(ROOT, '.env.development')
	let vars: Map<string, string>
	try {
		vars = loadEnvFile(envPath)
	} catch {
		fail(
			'.env.development is missing or unreadable',
			'restore it: git checkout -- .env.development',
		)
	}
	const issues = validateEnvVars(vars)
	if (issues.length > 0) {
		for (const issue of issues) {
			console.error(`env (.env.development): ${issue.key} ${issue.problem}`)
		}
		fail(
			'.env.development is invalid',
			'fix the committed env file — .env.local overrides are checked by branch-env',
		)
	}
	const wasm = wasmState()
	if (wasm.bytes <= 0 || !wasm.present) {
		fail(
			'wasm kernel missing or unreadable (src/durable-objects/argon2-do-hasher.wasm)',
			`restore it: git checkout -- src/durable-objects/argon2-do-hasher.wasm — or rebuild: ${phaseCommand(detectPm(), 'build:wasm')} (needs rust)`,
		)
	}
}

type PlanDisplay = {dryRun: boolean; canPrompt: boolean}

function printPlan(target: IdentityTarget, display: PlanDisplay): void {
	// A dry-run plan is the command's primary output (stdout, pipeable),
	// not chatter: --quiet suppresses progress, never the plan itself.
	if (isQuietMode() && !display.canPrompt && !display.dryRun) {
		return
	}
	const description: string = target.description !== '' ? target.description : '(cleared)'
	const header: string = display.dryRun ? 'plan (nothing changed):' : 'plan:'
	// Dry-run plans are the pipeable primary output (stdout); every other
	// plan goes to stderr so it never pollutes a stdout pipe.
	const write: (message: string) => void = display.dryRun ? console.log : console.error
	write(`${header}
  app name:    ${target.name}
  description: ${description}
  files:       package.json, wrangler.jsonc, src/app-info.ts (name/description only), public/llms.txt
  env:         .env.development ok
  wasm:        kernel present`)
}

async function main(): Promise<void> {
	const cfg: CliConfig = parseCliArgs(process.argv.slice(2))
	const {canPrompt, ask, close} = setupPhase(
		{quiet: cfg.quiet, yes: cfg.yes, noInput: cfg.noInput, dryRun: cfg.dryRun},
		{
			sigint: 'interrupted — re-run app-identity to converge any partial identity writes',
			sigterm: 'terminated — re-run app-identity to converge any partial identity writes',
		},
	)
	try {
		step('checking project identity…')
		const snapshot: IdentitySnapshot = readIdentitySnapshot()
		const values = identityValues(snapshot)
		checkProjectFiles()
		const rerun: string = phaseCommand(detectPm(), 'app-identity')
		const targetName: string = await resolveName({
			cliName: cfg.name,
			skipRename: cfg.skipRename,
			canPrompt,
			ask,
			currentName: values.name,
			dirName: basename(ROOT),
			rerun,
		})
		const description: string = await resolveDescription({
			cliDescription: cfg.description,
			canPrompt,
			ask,
			currentDescription: values.description,
			rerun,
		})
		const target: IdentityTarget = {name: targetName, description}
		printPlan(target, {dryRun: cfg.dryRun, canPrompt})
		if (cfg.dryRun) {
			return
		}
		if (canPrompt) {
			const proceed: string = await ask('apply this identity? (Y/n)', {
				defaultValue: 'y',
				validate: confirmValidator('y'),
			})
			if (isDeclined(proceed)) {
				fail('app-identity aborted — no changes were made', `re-run when ready: ${rerun}`, 1)
			}
		}
		applyIdentity(snapshot, values, target)
		ok(`app identity is ${target.name}`)
		if (!isQuietMode()) {
			console.log(`app-identity complete — next: ${phaseCommand(detectPm(), 'install-deps')}`)
		}
	} finally {
		close()
	}
}

runEntry(import.meta.url, main, resumeHint)

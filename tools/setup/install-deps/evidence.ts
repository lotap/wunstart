// Checkout evidence: everything install-deps uses to resolve a toolchain
// without remembered answers.

import {existsSync} from 'node:fs'
import {join} from 'node:path'

import {fail} from '../../helpers/output.ts'
import type {PresentLockfile} from '../../helpers/package-manager.ts'
import {presentLockfiles} from '../../helpers/package-manager.ts'
import {ROOT} from '../../helpers/paths.ts'
import {readPackageJson} from '../../helpers/project-files.ts'

export type Evidence = {
	packageManagerField: string | undefined
	lockfiles: Array<PresentLockfile>
	hasNodeModules: boolean
	hasPnpmWorkspace: boolean
}

export function readEvidence(): Evidence {
	const pkg = readPackageJson()
	if (!pkg.ok) {
		const problem: string = pkg.reason === 'invalid' ? 'not valid JSON' : 'unreadable'
		fail(`package.json is ${problem}`, 'restore it: git checkout -- package.json')
	}
	return {
		packageManagerField: pkg.file.packageManager,
		lockfiles: presentLockfiles(),
		hasNodeModules: existsSync(join(ROOT, 'node_modules')),
		hasPnpmWorkspace: existsSync(join(ROOT, 'pnpm-workspace.yaml')),
	}
}

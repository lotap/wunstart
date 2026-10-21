import {connect} from 'node:net'

// Outside-world checks both sides share: TCP reachability and child-death
// signals. branch-env's port scans and validate-setup's probes must agree on
// both, so they live together in this dependency-free leaf module rather
// than duplicated per consumer. A third, unrelated check does not belong
// here (AGENTS.md Placement).

/**
 * One TCP probe with the localhost dual-stack rule: 'localhost' can
 * resolve to either family, and a ::1-only bind reads as down on a
 * v4-only check. Non-localhost hosts probe directly. Shared by
 * branch-env's port scans and validate-setup's reachability checks so the
 * two cannot drift apart.
 */
export async function probeBoth(host: string, port: number, timeoutMs: number): Promise<boolean> {
	if (host !== 'localhost') {
		return probeTcp(host, port, timeoutMs)
	}
	const [v4, v6] = await Promise.all([
		probeTcp('127.0.0.1', port, timeoutMs),
		probeTcp('::1', port, timeoutMs),
	])
	return v4 || v6
}

/**
 * One TCP connect attempt. First-wins resolve makes a settled guard
 * unnecessary: whichever of connect/timeout/error fires first decides,
 * the rest are safe no-ops.
 */
export function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		const socket = connect({host, port})
		socket.setTimeout(timeoutMs)
		socket.once('connect', () => {
			socket.destroy()
			resolve(true)
		})
		socket.once('timeout', () => {
			socket.destroy()
			resolve(false)
		})
		socket.once('error', () => {
			socket.destroy()
			resolve(false)
		})
	})
}

/** Signal a child died by (spawnSync) or carried (execFileSync error). */
export type ChildSignal = string | null | undefined

/**
 * Whether a child died by Ctrl-C (whole process group) rather than failing
 * on its own. Only SIGINT: a SIGTERM kill is our own timeout, which keeps
 * failing normally. Shared so branch-env's spawns and validate-setup's
 * docker probe agree on which signal means "interrupted".
 */
export function killedBySigint(signal: ChildSignal): boolean {
	return signal === 'SIGINT'
}

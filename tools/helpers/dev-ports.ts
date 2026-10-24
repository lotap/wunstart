// Dev-server port policy shared by branch-env, validate-setup, and vite.config. The human
// server keeps one default in every worktree; agent servers own the hashed
// range and never borrow the human port. tools/pkg-scripts/agent-dev.sh
// duplicates the range because a POSIX shell cannot import this module —
// keep the two in sync when the policy changes.

/** The human dev server's default port. Never inside the agent range. */
export const HUMAN_DEV_PORT_WANT = 3000

/** First port in the agent-only range (inclusive). */
export const AGENT_DEV_PORT_MIN = 3100

/** Last port in the agent-only range (inclusive). */
export const AGENT_DEV_PORT_MAX = 3199

/** Number of ports in the agent-only range. */
export const AGENT_DEV_PORT_WIDTH = AGENT_DEV_PORT_MAX - AGENT_DEV_PORT_MIN + 1

/** True when a port belongs to the agent-only range. */
export function inAgentDevRange(port: number): boolean {
	return port >= AGENT_DEV_PORT_MIN && port <= AGENT_DEV_PORT_MAX
}

/**
 * Parsed port claim (present + strict decimal integer + 1–65535), or null
 * for absent/garbage. Strict digits keep this aligned with agent-dev.sh's
 * shell parser: `3100.0`, `1e3`, and `0x10` are not port claims.
 */
export function parsePort(raw: string | undefined): number | null {
	if (raw === undefined || !/^[0-9]+$/.test(raw)) {
		return null
	}

	const port: number = Number(raw)

	if (port < 1 || port > 65535) {
		return null
	}

	return port
}

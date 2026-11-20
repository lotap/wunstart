/** Mailpit inbox URL for this worktree, when one is configured. */
export const mailpitUrl = import.meta.env.MAILPIT_URL ?? null

/** Local service URLs and commands. */
export const localServices = {
	studioUrl: 'https://local.drizzle.studio',
	studioCommand: 'bun run db:studio',
	reactEmailUrl: 'http://localhost:3001',
	reactEmailCommand: 'bun run dev:email',
}

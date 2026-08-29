import {defineConfig} from 'drizzle-kit'

export default defineConfig({
	dialect: 'postgresql',
	out: './src/db/migrations',
	schema: './src/db/models/**/*(schema|view)s.ts',
	dbCredentials: {
		url:
			// oxlint-disable-next-line no-undef
			process.env['DATABASE_URL'] ??
			(() => {
				throw new Error('DATABASE_URL is missing')
			})(),
	},
	// Print all statements
	// verbose: true,
	// Always ask for confirmation
	// strict: true,
})

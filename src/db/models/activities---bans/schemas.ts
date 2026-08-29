import {pgEnum} from 'drizzle-orm/pg-core'

export const banScopes = pgEnum('ban_scopes', [
	'IP_ADDRESS',
	'USER',
	'ANON',
	'FAILED_CREDENTIAL',
	'ARCHIVED_USER',
	'ARCHIVED_ANON',
])

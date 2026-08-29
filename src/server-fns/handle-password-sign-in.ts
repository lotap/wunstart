import {createServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {passwordSignIn} from '#/db/ops/auth/password-sign-in.ts'
import {emailLayer} from '#/email/layer.ts'
import {PasswordSignInCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAnon} from '#/middleware/require-anon.ts'

export const handlePasswordSignIn = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAnon])
	.validator(Schema.toStandardSchemaV1(PasswordSignInCredentials))
	.handler(async ({data, context: {ipAddress, userAgent, country, anon}}) => {
		const {access, session} = await runOp({
			op: passwordSignIn,
			data: {input: data, ipAddress, userAgent, country, anonTokenPayload: anon},
			layers: [authLayer, dbLayer, emailLayer],
		})

		setAuthCookies({access, session})
	})

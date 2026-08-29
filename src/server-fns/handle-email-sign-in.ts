import {createServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailSignIn} from '#/db/ops/auth/email/sign-in.ts'
import {emailLayer} from '#/email/layer.ts'
import {EmailSignInCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAnonRegistered} from '#/middleware/require-anon-registered.ts'

export const handleEmailSignIn = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAnonRegistered])
	.validator(Schema.toStandardSchemaV1(EmailSignInCredentials))
	.handler(async ({data, context}) => {
		const {ipAddress, userAgent, country, city, region, anon} = context

		const {access, session} = await runOp({
			op: emailSignIn,
			data: {input: data, anonTokenPayload: anon, ipAddress, userAgent, country, city, region},
			layers: [authLayer, dbLayer, emailLayer],
		})

		setAuthCookies({access, session})
	})

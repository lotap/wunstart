import {createServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailSignUp} from '#/db/ops/auth/email/sign-up.ts'
import {EmailSignUpCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAnonRegistered} from '#/middleware/require-anon-registered.ts'

export const handleEmailSignUp = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAnonRegistered])
	.validator(Schema.toStandardSchemaV1(EmailSignUpCredentials))
	.handler(async ({data, context}) => {
		const {ipAddress, userAgent, country, anon} = context

		const {access, session} = await runOp({
			op: emailSignUp,
			data: {input: data, anonTokenPayload: anon, ipAddress, userAgent, country},
			layers: [authLayer, dbLayer],
		})

		setAuthCookies({access, session})
	})

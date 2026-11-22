import {createServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {passwordChange} from '#/db/ops/auth/strategies/password/password-change.ts'
import {emailLayer} from '#/email/layer.ts'
import {checkPasswordStrength} from '#/isomorphic/password-strength.ts'
import {PasswordChangeCredentials} from '#/isomorphic/validations/auth.ts'
import {runOpClearingDeadSession} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {clearAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {throwKnownServerError} from '#/middleware/known-server-error.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handlePasswordChange = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.validator(Schema.toStandardSchemaV1(PasswordChangeCredentials))
	.handler(
		async ({
			data,
			context: {
				ipAddress,
				userAgent,
				country,
				city,
				region,
				timezone,
				auth: {userId, sudoExpiresAt, refreshToken},
			},
		}) => {
			/**
			 * The schema only enforces length/encoding limits, so the strength
			 * check happens here where the lazy-loaded zxcvbn dictionaries are
			 * only fetched for actual password submissions
			 */
			const {isStrong, message} = await checkPasswordStrength(data.password)

			if (!isStrong) throwKnownServerError(422, message)

			const {anonToken} = await runOpClearingDeadSession({
				op: passwordChange,
				data: {
					input: data,
					ipAddress,
					userAgent,
					country,
					city,
					region,
					timezone,
					userId,
					sudoExpiresAt,
					refreshToken,
				},
				layers: [authLayer, dbLayer, emailLayer],
			})

			/**
			 * When requested, all of the user's sessions were archived, including
			 * this request's, so end the local session and fall back to an anon
			 * identity
			 */
			if (anonToken) {
				clearAuthCookies()

				setAnonCookie(anonToken.token)
			}
		},
	)

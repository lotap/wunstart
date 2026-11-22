import {createServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {passwordChange} from '#/db/ops/auth/strategies/password/password-change.ts'
import {getUserEmail} from '#/db/ops/auth/users/get-user-email.ts'
import {emailLayer} from '#/email/layer.ts'
import {checkPasswordStrength} from '#/isomorphic/password-strength.ts'
import {PasswordChangeCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp, runOpClearingDeadSession} from '#/middleware/_run-op.server.ts'
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
			 * The client check is live feedback; this one is authoritative. It
			 * includes the real email (the profile endpoint only exposes the
			 * masked form), so the server is at least as strict. See
			 * checkPasswordStrength for the shared server-side rule.
			 */
			const {email} = await runOp({
				op: getUserEmail,
				data: {userId, sudoExpiresAt, ipAddress},
				layers: [authLayer, dbLayer],
			})

			const {isStrong, message} = await checkPasswordStrength(data.password, [email])

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

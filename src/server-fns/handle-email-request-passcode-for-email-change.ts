import {createServerFn} from '@tanstack/react-start'
import {DateTime, Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {VERIFICATION_EXPIRED_MESSAGE} from '#/db/ops/auth/messages.ts'
import {emailRequestPasscode} from '#/db/ops/auth/strategies/email/request-passcode.ts'
import {emailLayer} from '#/email/layer.ts'
import {EmailCredentials} from '#/isomorphic/validations/auth.ts'
import {runOpClearingDeadSession} from '#/middleware/_run-op.server.ts'
import {throwKnownServerError} from '#/middleware/known-server-error.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

/**
 * Request a verification code for a new email address
 * - re-checks sudo at confirm time.
 * - row is keyed by the new email + userId
 * - reuses the `reverify` intent (recipient checks skipped, sign-in copy)
 * - A taken address fails generically at confirm time, so nothing here leaks registration
 */
export const handleEmailRequestPasscodeForEmailChange = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.validator(Schema.toStandardSchemaV1(EmailCredentials))
	.handler(async ({data: {email}, context: {ipAddress, auth}}) => {
		const {sudoExpiresAt, userId, refreshToken} = auth

		/**
		 * Deliberate: sudo is caller policy (the from-session reverify path needs
		 * none), and the op does not receive `sudoExpiresAt`. A dead session with a
		 * lapsed lease stops here; the reverify path then fails its live-session
		 * check and clears the pair. The confirm op re-checks sudo.
		 */
		if (!sudoExpiresAt || DateTime.isPastUnsafe(sudoExpiresAt))
			throwKnownServerError(422, VERIFICATION_EXPIRED_MESSAGE)

		const {expiresAt} = await runOpClearingDeadSession({
			op: emailRequestPasscode,
			data: {
				input: {email, intent: 'reverify'},
				anonTokenPayload: null,
				ipAddress,
				userId,
				refreshToken,
			},
			layers: [authLayer, dbLayer, emailLayer],
		})

		return {expiresAt}
	})

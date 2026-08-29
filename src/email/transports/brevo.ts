import {Config, Context, Effect, Layer, Option, Redacted} from 'effect'

import {
	EmailConfig,
	EmailFailureKind,
	EmailSendError,
	toEmailSendError,
	type EmailMessage,
} from '#/email/service.ts'

const BrevoApiUrl = 'https://api.brevo.com/v3/smtp/email'

/**
 * Classify a Brevo status code by what it proves about acceptance:
 * 401/403 mean the key cannot send (config); 429 was refused before
 * acceptance under load (transient); other 4xx permanently refuse this
 * message (rejected); anything else leaves acceptance unknown (ambiguous).
 */
const statusKind = (status: number): EmailFailureKind => {
	if (status === 401 || status === 403) return 'config'
	if (status === 429) return 'transient'
	if (status >= 400 && status < 500) return 'rejected'
	return 'ambiguous'
}

export class BrevoEmail extends Context.Service<
	BrevoEmail,
	{
		readonly send: (message: EmailMessage) => Effect.Effect<void, EmailSendError>
	}
>()('BrevoEmail') {}

const sendRequest = (apiKey: string, from: string, message: EmailMessage) =>
	Effect.tryPromise({
		try: () =>
			fetch(BrevoApiUrl, {
				method: 'POST',
				headers: {
					'api-key': apiKey,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					sender: {email: from},
					to: [{email: message.to}],
					subject: message.subject,
					htmlContent: message.html,
					textContent: message.text,
				}),
			}),
		catch: (error) => toEmailSendError('brevo', error),
	})

export const brevoLayer = Layer.effect(
	BrevoEmail,
	Effect.gen(function* () {
		const {from} = yield* EmailConfig
		return BrevoEmail.of({
			send: Effect.fn('BrevoEmail.send')(function* (message: EmailMessage) {
				const apiKey = yield* Config.option(Config.redacted('BREVO_API_KEY')).pipe(
					Effect.mapError(
						() =>
							new EmailSendError({
								transport: 'brevo',
								code: 'config',
								kind: 'config',
								message: 'failed to read BREVO_API_KEY',
							}),
					),
				)
				if (Option.isNone(apiKey)) {
					return yield* new EmailSendError({
						transport: 'brevo',
						code: 'config',
						kind: 'config',
						message: 'BREVO_API_KEY is not configured',
					})
				}
				const response = yield* sendRequest(Redacted.value(apiKey.value), from, message)
				if (!response.ok) {
					const body = yield* Effect.tryPromise(() => response.text()).pipe(
						Effect.orElseSucceed(() => ''),
					)
					return yield* new EmailSendError({
						transport: 'brevo',
						code: String(response.status),
						kind: statusKind(response.status),
						message: body.slice(0, 200),
					})
				}
			}),
		})
	}),
)

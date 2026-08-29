import {Context, Effect, Layer} from 'effect'

import {EmailConfig, EmailSendError, toEmailSendError, type EmailMessage} from '../service.ts'

export class SendEmail extends Context.Service<
	SendEmail,
	{
		readonly send: (message: EmailMessage) => Effect.Effect<void, EmailSendError>
	}
>()('SendEmail') {}

export const sendEmailLayer = Layer.effect(
	SendEmail,
	Effect.gen(function* () {
		const {from} = yield* EmailConfig
		return SendEmail.of({
			send: Effect.fn('SendEmail.send')(function* (message) {
				const {env} = yield* Effect.tryPromise({
					try: () => import('cloudflare:workers'),
					catch: (cause: unknown) => toEmailSendError('sendemail', cause),
				})
				yield* Effect.tryPromise({
					try: () => env.EMAIL.send({...message, from}),
					catch: (error) => toEmailSendError('sendemail', error),
				})
			}),
		})
	}),
)

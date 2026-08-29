import {env} from 'cloudflare:workers'
import {Context, Effect, Layer} from 'effect'

import {EmailConfig, EmailSendError} from '../service.ts'
import type {EmailMessage} from '../service.ts'
import {toEmailSendError} from '../service.ts'

export class CloudflareSendmail extends Context.Service<
	CloudflareSendmail,
	{
		readonly send: (message: EmailMessage) => Effect.Effect<void, EmailSendError>
	}
>()('CloudflareSendmail') {}

export const cloudflareSendmailLayer = Layer.effect(
	CloudflareSendmail,
	Effect.gen(function* () {
		const {from} = yield* EmailConfig
		return CloudflareSendmail.of({
			send: Effect.fn('CloudflareSendmail.send')(function* (message: EmailMessage) {
				yield* Effect.tryPromise({
					try: () => env.EMAIL.send({...message, from}),
					catch: (error) => toEmailSendError('cloudflare-sendmail', error),
				})
			}),
		})
	}),
)

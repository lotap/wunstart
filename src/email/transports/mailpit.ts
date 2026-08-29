import {Config, Effect, Layer, Schema} from 'effect'
import {FetchHttpClient, HttpClientRequest} from 'effect/unstable/http'
import {execute} from 'effect/unstable/http/HttpClient'

import {EmailConfig, EmailSendError, EmailService, type EmailMessage} from '#/email/service.ts'

const MailpitBody = Schema.Struct({
	To: Schema.Array(
		Schema.Struct({
			Email: Schema.String,
			Name: Schema.String,
		}),
	),
	From: Schema.Struct({
		Email: Schema.String,
		Name: Schema.String,
	}),
	Subject: Schema.String,
	HTML: Schema.String,
	Text: Schema.String,
})

export const mailpitLayer = Layer.effect(
	EmailService,
	Effect.gen(function* () {
		const {from, appUrl} = yield* EmailConfig
		const mailpitUrl = yield* Config.string('MAILPIT_URL').pipe(
			Config.withDefault('http://localhost:8025'),
		)

		return EmailService.of({
			from,
			appUrl,
			send: Effect.fn('Mailpit.send')(function* (message: EmailMessage) {
				const body = {
					To: [{Email: message.to, Name: ''}],
					From: {Email: from, Name: ''},
					Subject: message.subject,
					HTML: message.html,
					Text: message.text,
				}

				yield* HttpClientRequest.schemaBodyJson(MailpitBody)(
					HttpClientRequest.post(`${mailpitUrl}/api/v1/send`),
					body,
				).pipe(
					Effect.flatMap(execute),
					Effect.asVoid,
					Effect.mapError(
						(error) =>
							new EmailSendError({
								transport: 'mailpit',
								code: '',
								kind: 'ambiguous',
								message: `to=${message.to} from=${from} subject=${message.subject} body=${message.text} error=${String(error)}`,
							}),
					),
					Effect.provide(FetchHttpClient.layer),
				)
			}),
		})
	}),
)

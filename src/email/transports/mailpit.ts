/**
 * `unstableApiUsage` warns that the Effect HTTP client, request, and Fetch layer
 * may change in any release. They are the only HTTP surface the package exposes
 * and are confined to this dev-only transport, so an upstream change breaks the
 * typecheck here instead of spreading through the mail code.
 */
import {Config, Effect, Layer, Schema} from 'effect'
import {FetchHttpClient, HttpClient, HttpClientRequest} from 'effect/http'

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
		// @effect-diagnostics-next-line unstableApiUsage:off
		const httpClient = yield* HttpClient.HttpClient

		const mailpitUrl = yield* Config.String('MAILPIT_URL').pipe(
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

				// @effect-diagnostics-next-line unstableApiUsage:off
				yield* HttpClientRequest.schemaBodyJson(MailpitBody)(
					// @effect-diagnostics-next-line unstableApiUsage:off
					HttpClientRequest.post(`${mailpitUrl}/api/v1/send`),
					body,
				).pipe(
					Effect.flatMap((request) => httpClient.execute(request)),
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
				)
			}),
		})
	}),
	// @effect-diagnostics-next-line unstableApiUsage:off
).pipe(Layer.provide(FetchHttpClient.layer))

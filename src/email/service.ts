import {Config, Context, Effect, Layer, Schema} from 'effect'

export type EmailMessage = {
	to: string
	subject: string
	html: string
	text: string
}

/**
 * How a send failure relates to delivery, decided by the transport that
 * attempted it:
 *
 * - `config`: the transport is unusable before sending (missing key/binding).
 *   Nothing was sent, so the fallback chain skips it for free.
 * - `transient`: the provider definitively refused before acceptance and may
 *   accept later (rate limits). Retrying cannot duplicate delivery.
 * - `rejected`: the provider permanently refused this message before
 *   acceptance (4xx validation/auth-of-message failures). No transport will
 *   take it as-is.
 * - `ambiguous`: outcome unknown. The message may have been accepted
 *   (network failure mid-flight, 5xx). Re-sending risks duplicates.
 */
export const EmailFailureKind = Schema.Literals([
	'config',
	'transient',
	'ambiguous',
	'rejected',
] as const)
export type EmailFailureKind = Schema.Schema.Type<typeof EmailFailureKind>

export class EmailSendError extends Schema.TaggedErrorClass<EmailSendError>()('EmailSendError', {
	transport: Schema.String,
	code: Schema.String,
	kind: EmailFailureKind,
	message: Schema.String,
}) {}

/** A notification template failed to render. No send was ever attempted */
export class EmailRenderError extends Schema.TaggedErrorClass<EmailRenderError>()(
	'EmailRenderError',
	{message: Schema.String},
) {}

/**
 * Network-level failures cannot rule out provider-side acceptance, so unknown
 * errors are tagged `ambiguous`, the honest default. Transports that know
 * more (an HTTP status, a missing key) construct `EmailSendError` directly.
 */
export const toEmailSendError = (transport: string, cause: unknown): EmailSendError =>
	new EmailSendError({
		transport,
		code: errorCode(cause),
		kind: 'ambiguous',
		message: cause instanceof Error ? cause.message : String(cause),
	})

const errorCode = (cause: unknown): string => {
	if (!(cause instanceof Error)) return ''
	// SAFETY: Node-style errors attach a `code` property the Error interface does
	// not declare; reading it is diagnostic only and re-validated as a string.
	const {code} = cause as {code?: unknown}
	return Schema.is(Schema.String)(code) ? code : ''
}

export class EmailConfig extends Context.Service<
	EmailConfig,
	{
		readonly from: string
		readonly appUrl: string
	}
>()('EmailConfig') {
	static readonly layer = Layer.effect(
		EmailConfig,
		Effect.gen(function* () {
			return EmailConfig.of({
				from: yield* Config.string('EMAIL_FROM').pipe(Config.withDefault('noreply@wunstart.com')),
				appUrl: yield* Config.string('APP_URL').pipe(Config.withDefault('http://localhost:3000')),
			})
		}),
	)
}

export class EmailService extends Context.Service<
	EmailService,
	{
		readonly from: string
		readonly appUrl: string
		send: (message: EmailMessage) => Effect.Effect<void, EmailSendError>
	}
>()('EmailService') {}

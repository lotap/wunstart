import {Config, Effect, Layer, Schema, Schedule, SchemaGetter} from 'effect'

import {EmailConfig, EmailSendError, EmailService} from './service.ts'
import type {EmailMessage} from './service.ts'
import {BrevoEmail, brevoLayer} from './transports/brevo.ts'
import {SendEmail, sendEmailLayer} from './transports/send-email.ts'

type EmailLayer = Layer.Layer<EmailService, Config.ConfigError | EmailLayerBuildError>

/** Dev-only layer-build failure: the mailpit transport module failed to load */
class EmailLayerBuildError extends Schema.TaggedErrorClass<EmailLayerBuildError>()(
	'EmailLayerBuildError',
	{message: Schema.String, cause: Schema.Unknown},
) {}

const TransportSchema = Schema.Literals(['sendemail', 'brevo'] as const)
type TransportName = Schema.Schema.Type<typeof TransportSchema>

const FallbackChainSchema = Schema.String.pipe(
	Schema.decodeTo(Schema.Array(TransportSchema), {
		decode: SchemaGetter.transform<TransportName[], string>((raw): TransportName[] =>
			raw
				.split(',')
				.map((name) => name.trim())
				.filter((name): name is TransportName => name !== '' && Schema.is(TransportSchema)(name)),
		),
		encode: SchemaGetter.transform<string, readonly TransportName[]>((names) => names.join(',')),
	}),
)

const fallbackChainConfig = (
	defaultValue: readonly TransportName[],
): Config.Config<readonly TransportName[]> =>
	Config.schema(FallbackChainSchema, 'EMAIL_FALLBACK').pipe(Config.withDefault(defaultValue))

/**
 * The failure reported once every transport in the chain has been tried.
 * Identity fields come from the last real send attempt (config skips are not
 * attempts); the kind is the honest aggregate: any ambiguous hop means
 * acceptance somewhere is unknown, an all-config chain means nothing was ever
 * sent, otherwise every hop provably refused before acceptance.
 */
const exhaustedFailure = (failures: readonly EmailSendError[]): EmailSendError => {
	const attempts = failures.filter((failure) => failure.kind !== 'config')
	const last = attempts[attempts.length - 1] ?? failures[failures.length - 1]
	return new EmailSendError({
		transport: last?.transport ?? 'sendemail',
		code: last?.code ?? 'chain-empty',
		kind:
			last?.kind === 'config'
				? 'config'
				: attempts.some((failure) => failure.kind === 'ambiguous')
					? 'ambiguous'
					: 'transient',
		message:
			failures
				.map((failure) => `${failure.transport} [${failure.kind}]: ${failure.message}`)
				.join('; ') || 'the fallback chain had no transports',
	})
}

const tryProviders = (
	chain: readonly TransportName[],
	senders: Record<TransportName, (message: EmailMessage) => Effect.Effect<void, EmailSendError>>,
	failures: readonly EmailSendError[],
	message: EmailMessage,
): Effect.Effect<void, EmailSendError> => {
	const [head, ...rest] = chain
	if (head === undefined) return Effect.fail(exhaustedFailure(failures))
	return senders[head](message).pipe(
		Effect.catch((error) =>
			error.kind === 'rejected'
				? /** The message itself was permanently refused. No transport will take it */
					Effect.fail(error)
				: /** Config/transient/ambiguous never prove another transport must fail too */
					tryProviders(rest, senders, [...failures, error], message),
		),
	)
}

const emailServiceLayer = (chain: readonly TransportName[]): EmailLayer =>
	Layer.provide(
		Layer.provide(
			Layer.effect(
				EmailService,
				Effect.gen(function* () {
					const sendEmail = yield* SendEmail
					const brevo = yield* BrevoEmail
					const {from, appUrl} = yield* EmailConfig
					const senders = {
						sendemail: (message: EmailMessage) => sendEmail.send(message),
						brevo: (message: EmailMessage) => brevo.send(message),
					} satisfies Record<
						TransportName,
						(message: EmailMessage) => Effect.Effect<void, EmailSendError>
					>
					return EmailService.of({
						from,
						appUrl,
						send: Effect.fn('EmailService.send')((message: EmailMessage) =>
							tryProviders(chain, senders, [], message).pipe(
								/**
								 * One whole-chain retry after a brief pause, and only when
								 * every hop provably did not accept the message (config skips
								 * or transient refusals aggregate to kind 'transient'). An
								 * ambiguous or rejected outcome is never re-sent: without proof
								 * of non-acceptance, a retry risks double delivery.
								 */
								Effect.retry({
									times: 1,
									schedule: Schedule.spaced('250 millis'),
									while: (error) => error.kind === 'transient',
								}),
							),
						),
					})
				}),
			),
			Layer.merge(sendEmailLayer, brevoLayer),
		),
		EmailConfig.layer,
	)

const buildEmailLayer = (
	transport: TransportName,
	fallbacks: readonly TransportName[],
): EmailLayer => emailServiceLayer([...new Set([transport, ...fallbacks])])

const devEmailLayer = (): EmailLayer =>
	Layer.unwrap(
		Effect.gen(function* () {
			const transport = yield* Config.schema(
				Schema.Literals(['mailpit', 'sendemail', 'brevo']),
				'EMAIL_TRANSPORT',
			).pipe(Config.withDefault('mailpit'))
			if (transport === 'mailpit') {
				const {mailpitLayer} = yield* Effect.tryPromise({
					try: () => import('./transports/mailpit.ts'),
					catch: (cause: unknown) =>
						new EmailLayerBuildError({
							message: 'Failed to load the mailpit email transport.',
							cause,
						}),
				})
				return Layer.provide(mailpitLayer, EmailConfig.layer)
			}
			const fallbacks = yield* fallbackChainConfig([])
			return buildEmailLayer(transport, fallbacks)
		}),
	)

const prodEmailLayer = (): EmailLayer =>
	Layer.unwrap(
		Effect.gen(function* () {
			const transport = yield* Config.schema(TransportSchema, 'EMAIL_TRANSPORT').pipe(
				Config.withDefault('sendemail'),
			)
			const fallbacks = yield* fallbackChainConfig(['brevo'])
			return buildEmailLayer(transport, fallbacks)
		}),
	)

export const emailLayer = import.meta.env.DEV ? devEmailLayer() : prodEmailLayer()

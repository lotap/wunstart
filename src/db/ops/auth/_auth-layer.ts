import {Config, ConfigProvider, Context, Effect, Layer, Redacted} from 'effect'

type ParsedSecrets = {
	readonly secretsEntries: [id: string, secret: Redacted.Redacted][]
	readonly secretsMap: Map<string, Redacted.Redacted>
}

function parseSecrets(secretPairsList: string) {
	const pairs = secretPairsList.split(',')
	const secretsEntries: [string, Redacted.Redacted][] = []
	const secretsMap = new Map<string, Redacted.Redacted>()

	for (const pair of pairs) {
		const [id, secret] = pair.split(':')
		if (!id || !secret)
			/** Misconfigured secrets should prevent the app from starting */
			return Effect.fail(
				new Config.ConfigError(
					new ConfigProvider.SourceError({
						message: 'must be in `id:secret` format with non-empty id and secret',
					}),
				),
			)

		const redacted = Redacted.make(secret)
		secretsEntries.push([id, redacted])
		secretsMap.set(id, redacted)
	}

	return Effect.succeed({secretsEntries, secretsMap})
}

function createTokenSecretsConfig<Tag extends string>(tag: Tag, envVar: string) {
	class ConfigService extends Context.Service<ConfigService, ParsedSecrets>()(tag) {
		static readonly layer = Layer.effect(
			this,
			Config.redacted(envVar).pipe(
				Config.mapOrFail((secrets) => parseSecrets(Redacted.value(secrets))),
			),
		)
	}
	return ConfigService
}

export const AccessTokenSecretsConfig = createTokenSecretsConfig(
	'AccessTokenSecretsConfig',
	'ACCESS_TOKEN_SECRETS',
)

export const AnonTokenSecretsConfig = createTokenSecretsConfig(
	'AnonTokenSecretsConfig',
	'ANON_TOKEN_SECRETS',
)

export const RefreshTokenSecretsConfig = createTokenSecretsConfig(
	'RefreshTokenSecretsConfig',
	'REFRESH_TOKEN_SECRETS',
)

export const RefreshGraceTokenSecretsConfig = createTokenSecretsConfig(
	'RefreshGraceTokenSecretsConfig',
	'REFRESH_GRACE_TOKEN_SECRETS',
)

export const authLayer = Layer.mergeAll(
	AccessTokenSecretsConfig.layer,
	AnonTokenSecretsConfig.layer,
	RefreshTokenSecretsConfig.layer,
	RefreshGraceTokenSecretsConfig.layer,
)

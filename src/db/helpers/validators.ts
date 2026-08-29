import {DateTime, Effect, Schema, SchemaGetter, SchemaTransformation} from 'effect'

// From https://regex101.com/library/8d0bGE
const ARGON2_HASH_REGEX =
	/^\$argon2id\$v=(?:16|19)\$m=\d{1,10},t=\d{1,10},p=\d{1,3}(?:,keyid=[A-Za-z0-9+/]{0,11}(?:,data=[A-Za-z0-9+/]{0,43})?)?\$[A-Za-z0-9+/]{11,64}\$[A-Za-z0-9+/]{16,86}$/iu

export const Argon2Hash = Schema.String.check(Schema.isPattern(ARGON2_HASH_REGEX))

// From: https://github.com/open-circle/valibot/blob/main/library/src/regex.ts
const IP_REGEX =
	/^(?:(?:[1-9]|1\d|2[0-4])?\d|25[0-5])(?:\.(?:(?:[1-9]|1\d|2[0-4])?\d|25[0-5])){3}$|^(?:(?:[\da-f]{1,4}:){7}[\da-f]{1,4}|(?:[\da-f]{1,4}:){1,7}:|(?:[\da-f]{1,4}:){1,6}:[\da-f]{1,4}|(?:[\da-f]{1,4}:){1,5}(?::[\da-f]{1,4}){1,2}|(?:[\da-f]{1,4}:){1,4}(?::[\da-f]{1,4}){1,3}|(?:[\da-f]{1,4}:){1,3}(?::[\da-f]{1,4}){1,4}|(?:[\da-f]{1,4}:){1,2}(?::[\da-f]{1,4}){1,5}|[\da-f]{1,4}:(?::[\da-f]{1,4}){1,6}|:(?:(?::[\da-f]{1,4}){1,7}|:)|fe80:(?::[\da-f]{0,4}){0,4}%[\da-z]+|::(?:f{4}(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1?\d)?\d)\.){3}(?:25[0-5]|(?:2[0-4]|1?\d)?\d)|(?:[\da-f]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1?\d)?\d)\.){3}(?:25[0-5]|(?:2[0-4]|1?\d)?\d))$/iu

/**
 * Validation for ipv4/ipv6
 * Necessary because `createInsertSchema`/`createSelectSchema` don't automatically apply IP validation to inet columns.
 */
export const IpAddress = Schema.String.check(Schema.isPattern(IP_REGEX))
export const IpAddresses = Schema.Array(IpAddress)

const PG_VERBOSE_INTERVAL_REGEX =
	/^(?:@ )?(?:(?:\+|-)?infinity)|(?:(?:\d+(?:\.\d+)?) (?:(?:mil(?:s?|lenni(?:um|a)))|(?:c(?:ent(?:ury|uries)?)?)|(?:dec(?:ade)?s?)|(?:y(?:(?:r|ear)s?)?)|(?:q(?:tr|uarter))|(?:mon(?:th)?s?)|(?:w(?:eeks?)?)|(?:d(?:ays?)?)|(?:h(?:(?:r|our)s?)?)|(?:m(?:in(?:ute)?s?)?)|(?:s(?:ec(?:ond)?s?)?)|(?:ms(?:ec(?:ond)?s?)?|millisecon(?:ds?)?)|(?:us(?:ec(?:ond)?s?)?|microsecon(?:ds?)?))(?:(?= \w) |$)){1,13}(?:ago)?$/iu

/**
 * Validation for postgres intervals with verbose syntax
 * https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-INTERVAL-INPUT
 */
export const PGVerboseInterval = Schema.String.check(Schema.isPattern(PG_VERBOSE_INTERVAL_REGEX))

/** Convenience validation for UUIDs */
export const UUID = Schema.String.check(Schema.isUUID())

export const withNullDefault = <S extends Schema.Top>(schema: S) =>
	schema.pipe(Schema.withDecodingDefault<S>(Effect.succeed(null)))

/** Accept null or undefined, default to null on undefined */
export const NullishToNull = Schema.optional(Schema.Null).pipe(withNullDefault)

export const DateTimeUtcFromSeconds = Schema.Finite.pipe(
	Schema.check(Schema.isBetween({minimum: -8_640_000_000_000, maximum: 8_640_000_000_000})),
	Schema.decodeTo(
		Schema.DateTimeUtc,
		new SchemaTransformation.Transformation(
			SchemaGetter.transform((seconds) => DateTime.makeUnsafe(seconds * 1000)),
			SchemaGetter.transform((utc) => Math.floor(utc.epochMilliseconds / 1000)),
		),
	),
)

export const DateFromDateTimeUtc = Schema.DateTimeUtc.pipe(
	Schema.decodeTo(
		Schema.Date,
		new SchemaTransformation.Transformation(
			SchemaGetter.transform((utc) => DateTime.toDateUtc(utc)),
			SchemaGetter.transform((date) => DateTime.fromDateUnsafe(date)),
		),
	),
	Schema.check(
		Schema.makeFilter((date: Date) => {
			const ms = date.getTime()
			return Number.isFinite(ms) && Math.abs(ms) <= 8_640_000_000_000_000
		}),
	),
)

export const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))

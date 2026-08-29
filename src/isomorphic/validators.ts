import {Schema, SchemaTransformation} from 'effect'

// From: https://github.com/open-circle/valibot/blob/main/library/src/regex.ts
const EMAIL_REGEX = /^[\w+-]+(?:\.[\w+-]+)*@[\da-z]+(?:[.-][\da-z]+)*\.[a-z]{2,}$/iu

export const Email = Schema.String.pipe(
	// trim() to handle common input quirks with leading/trailing whitespace
	Schema.decode(SchemaTransformation.trim()),
	// always use lowercase for case-sensitive dedupe
	Schema.decode(SchemaTransformation.toLowerCase()),
	// https://errata.rfc-editor.org/eid1690/ specifies a max of 254 characters
	Schema.check(
		Schema.isMaxLength(254, {
			message: 'That email address is too long to be real. Double-check it?',
		}),
	),
	// match email pattern spec
	Schema.check(
		Schema.isPattern(EMAIL_REGEX, {
			message: 'That doesn’t look like a complete email address. Check for typos?',
		}),
	),
)

export const Password = Schema.String.pipe(
	/**
	 * Based on NIST guidelines https://pages.nist.gov/800-63-3/sp800-63b.html#5111-memorized-secret-authenticators
	 * May increase to 15 following new draft https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-63B-4.2pd.pdf
	 */
	Schema.check(Schema.isMinLength(8, {message: 'Passwords need at least 8 characters.'})),
	/**
	 * The `normalize` transformation is used to ensure consistent unicode support.
	 * Read more about unicode normalization [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize#description)
	 */
	Schema.decode(
		SchemaTransformation.transform({
			decode: (s: string) => s.normalize('NFKC'),
			encode: (s) => s,
		}),
	),
	/**
	 * 72 bytes is the max allowed by bcrypt. This project is set up to use argon2 by default,
	 * but some projects may need to use bcrypt to cut down on third-party packages
	 *
	 * It is also large enough to allow a 64 character passphrase while
	 * short enough to prevent [DoS attacks associated with long passwords](https://www.acunetix.com/vulnerabilities/web/long-password-denial-of-service/)
	 */
	Schema.check(
		Schema.makeFilter((s) => new TextEncoder().encode(s).length <= 72, {
			message: 'That password is too long to store. Try a shorter one.',
		}),
	),
)

export const Passcode = Schema.String.pipe(
	Schema.check(
		Schema.isPattern(/^\d{6}$/, {
			message: 'Passcodes are 6 digits — check the code we sent.',
		}),
	),
)

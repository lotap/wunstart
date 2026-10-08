/**
 * Convention: one export per distinct input shape. Flows with identical shapes
 * share an export (sign-in and sign-up both use `EmailPasscodeCredentials`);
 * a flow gets its own export only when its shape is actually different or
 * expected to diverge
 */

import {Schema, Tuple} from 'effect'

import {Email, Passcode, Password} from '#/isomorphic/validators.ts'

export const PasscodeCredentials = Schema.Struct({
	passcode: Passcode,
})

export const PasswordCredentials = Schema.Struct({
	password: Password,
})

export const EmailCredentials = Schema.Struct({
	email: Email,
})

export const EmailPasscodeCredentials = Schema.Struct({
	email: Email,
	passcode: Passcode,
})

export const EmailPasswordCredentials = Schema.Struct({
	email: Email,
	password: Password,
})

const RequestPasscodeOriginator = Schema.Literals(['sign-up', 'sign-in'])

export const PasscodeIntent = RequestPasscodeOriginator.mapMembers(
	Tuple.appendElement(Schema.Literal('reverify')),
)

/** Anonymous code request. Intent selects email copy; never gates delivery */
export const EmailPasscodeIntentCredentials = Schema.Struct({
	email: Email,
	intent: RequestPasscodeOriginator,
})

export const PasswordChangeCredentials = Schema.Struct({
	password: Password,
	signOutAllSessions: Schema.optional(Schema.Boolean),
})

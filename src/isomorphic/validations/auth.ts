import {Schema} from 'effect'

import {Email, Passcode, Password} from '#/isomorphic/validators.ts'

const EmailPasscodeCredentials = Schema.Struct({
	email: Email,
	passcode: Passcode,
})

const PasswordCredentials = Schema.Struct({
	password: Password,
})

export const EmailRequestVerificationCredentials = Schema.Struct({
	email: Email,
	expectRegisteredRecipient: Schema.optional(Schema.Boolean),
})

export const EmailReverifyCredentials = Schema.Struct({
	passcode: Passcode,
})

export const EmailSignInCredentials = EmailPasscodeCredentials

export const EmailSignUpCredentials = EmailPasscodeCredentials

export const PasswordChangeCredentials = Schema.Struct({
	password: Password,
	signOutAllSessions: Schema.optional(Schema.Boolean),
})

export const PasswordReverifyCredentials = PasswordCredentials

export const PasswordSignInCredentials = Schema.Struct({
	email: Email,
	password: Password,
})

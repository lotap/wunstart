import type {AnonTokenPayloadCustomClaims} from '../_anon-token.ts'

/**
 * Request context shared by the passcode verification entry and its sign-in and
 * sign-up branches. Defined here so the branches do not depend on the entry op.
 */
export type VerifyPasscodeContext = {
	email: string
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	timezone: string | null
	anonTokenPayload: AnonTokenPayloadCustomClaims
}

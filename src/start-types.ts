import type {DegradedAuth} from './middleware/_degraded-auth.ts'
import type {AnonContext} from './middleware/verify-anon.ts'
import type {AuthContext} from './middleware/verify-auth.ts'

/** The context as produced by the verification middlewares. May carry the degraded state */
export interface VerifiedServerFnContext {
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	auth: AuthContext['auth']
	anon: AnonContext['anon']
}

/**
 * The context as server functions see it: the global `rejectDegradedAuth` middleware
 * (start.ts) rejects degraded requests before they reach here, so the degraded state
 * never appears downstream.
 */
export interface GlobalServerFnContext {
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	auth: Exclude<AuthContext['auth'], DegradedAuth>
	anon: Exclude<AnonContext['anon'], DegradedAuth>
}

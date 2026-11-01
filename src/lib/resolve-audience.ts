/** The audience a route serves: external marketing/auth or the internal app. */
export type Audience = 'external' | 'internal'

/** A route’s declaration: a concrete audience, or `adaptive` to resolve by auth. */
export type AudienceDeclaration = Audience | 'adaptive'

/** Resolve a route’s declared audience, defaulting to external for undeclared routes. */
export function resolveAudience(
	declared: AudienceDeclaration | undefined,
	authenticated: boolean,
): Audience {
	if (declared === 'adaptive') return authenticated ? 'internal' : 'external'

	return declared ?? 'external'
}

import {createMiddleware} from '@tanstack/react-start'
import {setResponseHeader} from '@tanstack/react-start/server'

/**
 * Server-function responses carry identity, session state, or an action result,
 * so they default to `Cache-Control: no-store` for both private and shared
 * HTTP caches. A GET response with no directive is still eligible for heuristic
 * caching, and cookies do not make a response private.
 *
 * The header is set before `next()` so a genuinely public, cacheable endpoint
 * can override it from its own middleware or handler; that endpoint owns the
 * complete policy, including `Vary`. Never implement caching by removing this
 * global default.
 */
export const serverFnNoStore = createMiddleware({type: 'function'}).server(({next}) => {
	setResponseHeader('Cache-Control', 'no-store')

	return next()
})

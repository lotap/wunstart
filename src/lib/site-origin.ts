import {createIsomorphicFn} from '@tanstack/react-start'
import {getRequest} from '@tanstack/react-start/server'

/** The request origin during SSR, the browser origin after hydration. */
export const getSiteOrigin = createIsomorphicFn()
	.server(() => new globalThis.URL(getRequest().url).origin)
	.client(() => globalThis.location.origin)

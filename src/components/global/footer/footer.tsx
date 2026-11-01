import type {Audience} from '#/lib/resolve-audience.ts'

import {ExternalFooter} from './_external-footer.tsx'
import {InternalFooter} from './_internal-footer.tsx'

export function Footer({audience}: {audience: Audience}) {
	return audience === 'internal' ? <InternalFooter /> : <ExternalFooter />
}

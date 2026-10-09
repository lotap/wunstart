import {PasswordChangeDrawer} from '#/components/auth/password-change.tsx'
import {RemoveAccountDrawer} from '#/components/auth/remove-account.tsx'

import {SessionsSection} from './sessions.tsx'

export function AccessAndSecurity() {
	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-4">
				<h3 className="text-sm font-medium text-muted-foreground">Password</h3>
				<PasswordChangeDrawer triggerClassName="w-fit" triggerVariant="secondary" />
			</section>
			<SessionsSection />
			<section className="flex flex-col gap-4">
				<h3 className="text-sm font-medium text-muted-foreground">Danger zone</h3>
				<RemoveAccountDrawer triggerClassName="w-fit" />
			</section>
		</div>
	)
}

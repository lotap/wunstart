import {PasswordChangeDrawer} from '#/components/auth/password-change.tsx'
import {RemoveAccountDrawer} from '#/components/auth/remove-account.tsx'

import {SessionsSection} from './sessions.tsx'

export function AccessAndSecurity() {
	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-4">
				<PasswordChangeDrawer triggerClassName="w-fit" triggerVariant="secondary" />
			</section>
			<SessionsSection />
			<section className="flex flex-col gap-4">
				<h3 className="text-base text-muted-foreground">Danger Zone</h3>
				<RemoveAccountDrawer triggerClassName="w-fit" />
			</section>
		</div>
	)
}

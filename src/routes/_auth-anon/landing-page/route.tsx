import {createFileRoute} from '@tanstack/react-router'
import {useState} from 'react'

import {appInfo} from '#/app-info.ts'
import {pageMeta} from '#/lib/page-meta.ts'

import {GrowNextSection} from './-components/grow-next-section/grow-next-section.tsx'
import {IntroSections} from './-components/intro-sections/intro-sections.tsx'
import type {InstallTab} from './-content/get-started.ts'

export const Route = createFileRoute('/_auth-anon/landing-page')({
	component: LandingPage,
	head: () => ({
		meta: pageMeta('Build on primitives you can read', appInfo.description),
	}),
})

function LandingPage() {
	const [installTab, setInstallTab] = useState<InstallTab>('agent')

	return (
		<>
			<GrowNextSection onManualInstall={() => setInstallTab('manual')} />
			<IntroSections installTab={installTab} onInstallTabChange={setInstallTab} />
		</>
	)
}

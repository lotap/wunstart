import {createFileRoute} from '@tanstack/react-router'

import {appInfo} from '#/app-info.ts'
import {getSiteOrigin} from '#/lib/site-origin.ts'

import {AnonHome} from './-components/anon/home.tsx'
import {Dashboard} from './-components/dashboard/dashboard.tsx'

export const Route = createFileRoute('/_auth-dynamic/(home)/')({
	component: Home,
	head: () => {
		const url = `${getSiteOrigin()}/`

		return {
			meta: [
				{title: appInfo.name},
				{name: 'description', content: appInfo.description},
				{property: 'og:title', content: appInfo.name},
				{property: 'og:description', content: appInfo.description},
			],
			scripts: [
				{
					type: 'application/ld+json',
					// `#website` and `#organization` are graph node ids, not routes; neither needs a page.
					children: JSON.stringify({
						'@context': 'https://schema.org',
						'@graph': [
							{
								'@type': 'WebSite',
								'@id': `${url}#website`,
								'name': appInfo.name,
								url,
								'description': appInfo.description,
								'inLanguage': 'en',
								'publisher': {'@id': `${url}#organization`},
							},
							{
								'@type': 'Organization',
								'@id': `${url}#organization`,
								'name': appInfo.name,
								url,
							},
						],
					}),
				},
			],
		}
	},
})

function Home() {
	const {auth} = Route.useRouteContext()

	return auth ? <Dashboard /> : <AnonHome />
}

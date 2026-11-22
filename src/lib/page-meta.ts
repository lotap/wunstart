import {appInfo} from '#/app-info.ts'

/** Per-route metadata: the page title with the site name, plus its description and Open Graph pair. */
export function pageMeta(title: string, description: string) {
	const fullTitle = `${title} | ${appInfo.name}`

	return [
		{title: fullTitle},
		{name: 'description', content: description},
		{property: 'og:title', content: fullTitle},
		{property: 'og:description', content: description},
	]
}

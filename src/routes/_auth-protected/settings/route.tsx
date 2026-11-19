import {createFileRoute} from '@tanstack/react-router'
import {Schema} from 'effect'

import {pageMeta} from '#/lib/page-meta.ts'

import {CATEGORIES} from './-categories.ts'
import {SettingsPage} from './-components/page.tsx'

export const Route = createFileRoute('/_auth-protected/settings')({
	component: RouteComponent,
	head: () => ({
		meta: pageMeta('Settings', 'Manage your profile, preferences, and account security.'),
	}),
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			categories: Schema.optional(Schema.Array(Schema.Literals(CATEGORIES.map((c) => c.id)))),
		}),
	),
})

function RouteComponent() {
	const {categories = ['preferences']} = Route.useSearch()

	return <SettingsPage activeCategories={categories} />
}

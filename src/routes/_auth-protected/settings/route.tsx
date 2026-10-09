import {createFileRoute} from '@tanstack/react-router'
import {Schema} from 'effect'

import {SettingsPage} from './-components/page.tsx'
import {CATEGORIES} from './categories.ts'

export const Route = createFileRoute('/_auth-protected/settings')({
	component: RouteComponent,
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

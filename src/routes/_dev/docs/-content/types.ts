export type FeatureStatus = 'working' | 'preview' | 'planned'

type FeatureBase = {
	key: string
	name: string
	status: FeatureStatus
	summary: string
}

export type FeatureAction = {
	label: string
	description: string
	href: string
}

export type FeatureFlowChart = {
	label?: string
	source: string
}

export type FeatureReference = {
	label: string
	href: string
}

export type FeatureFlow = {
	key: string
	name: string
	routes: string[]
	serverFunctions: string[]
	ops: string[]
	models: string[]
	charts: FeatureFlowChart[]
	notes?: string[]
	mailpit?: boolean
}

export type AvailableFeature = FeatureBase & {
	status: 'working' | 'preview'
	actions: FeatureAction[]
	flows: FeatureFlow[]
	prompt: string
	notes?: string[]
	references?: FeatureReference[]
}

export type PlannedFeature = FeatureBase & {
	status: 'planned'
	placeholder: string
}

export type Feature = AvailableFeature | PlannedFeature

import type {ComponentType} from 'react'

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

export type FeatureIntro = {
	title: string
	body: string
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
	intro?: FeatureIntro
	panelLink?: {label: string; panel: 'static-images'}
	prompt: string
	notes?: string[]
	references?: FeatureReference[]
}

/** Component-backed feature entry. The target shape for every feature. */
export type ComponentFeature = {
	key: string
	name: string
	status: 'working' | 'preview'
	Panel: ComponentType
}

export type PlannedFeature = FeatureBase & {
	status: 'planned'
	placeholder: string
}

export type Feature = AvailableFeature | ComponentFeature | PlannedFeature

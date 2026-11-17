import {PlannedFeatureShell} from '../feature-blocks.tsx'

export function RbacFeature() {
	return (
		<PlannedFeatureShell
			title="RBAC"
			summary="Give people roles and limit what they can do."
			placeholder="No roles page or role tables."
		/>
	)
}

export function AnalyticsFeature() {
	return (
		<PlannedFeatureShell
			title="Analytics"
			summary="See how people use the app."
			placeholder="No dashboard or event table."
		/>
	)
}

export function FeatureFlagsFeature() {
	return (
		<PlannedFeatureShell
			title="Feature flags"
			summary="Control a feature without a deploy."
			placeholder="No flag controls or table."
		/>
	)
}

export function FileUploadFeature() {
	return (
		<PlannedFeatureShell
			title="File upload"
			summary="Let people upload files to the app."
			placeholder="No upload handling or storage."
		/>
	)
}

export function PaymentProcessingFeature() {
	return (
		<PlannedFeatureShell
			title="Payment processing"
			summary="Charge customers and manage plans."
			placeholder="No checkout or billing flow."
		/>
	)
}

export function AgenticIntegrationsFeature() {
	return (
		<PlannedFeatureShell
			title="Agentic integrations"
			summary="Give agents safe actions to take in your app."
			placeholder="No agent interface or tool registry."
		/>
	)
}

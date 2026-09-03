import {Component} from 'react'
import type {ErrorInfo, ReactNode} from 'react'

type ErrorBoundaryState = {error: Error | null}

export class ErrorBoundary extends Component<
	{
		fallback?: ReactNode
		children: ReactNode
	},
	ErrorBoundaryState
> {
	override state: ErrorBoundaryState = {error: null}

	static getDerivedStateFromError(error: Error) {
		return {error}
	}

	override componentDidCatch(error: Error, info: ErrorInfo) {
		console.error(error, info.componentStack)
	}

	override render() {
		if (this.state.error) {
			return this.props.fallback ?? null
		}
		return this.props.children
	}
}

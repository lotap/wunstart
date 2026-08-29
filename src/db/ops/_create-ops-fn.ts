import {Effect, Ref} from 'effect'

import {
	CurrentBansAndExcessiveActivities as CurrentBansAndExcessiveActivitiesService,
	type CurrentBansAndExcessiveActivitiesCtx,
} from './_current-bans-and-excessive-activities.ts'
import {logFailedActivity, logSuccessfulActivity} from './_logging.ts'
import {extractErrorProps, isOpsError, opsFailure, type OpsErrorContract} from './ops-error.ts'

/** Optional logging overrides an op's success value may carry. */
type LoggingFields = {
	logging?: Partial<Parameters<typeof logSuccessfulActivity>[0]>
}

/** Per-invocation logging toggles every ops function accepts alongside its params. */
type OpsInvocationOptions = {
	ipAddress: string
	anonId?: string
	userId?: string
	logOnSuccess?: boolean
	logOnFailure?: boolean
}

/**
 * Swallows logging failures (the structured error log already fired inside
 * `logActivityAndHandleBans`). Neither catch nor catchDefect absorbs
 * interruptions
 */
const ignoreLoggingFailure = <AE, EE, RE>(effect: Effect.Effect<AE, EE, RE>) =>
	effect.pipe(
		Effect.catch(() => Effect.void),
		Effect.catchDefect(() => Effect.void),
	)

/**
 * Convenience factory for ops with automatic activity logging.
 * Extracts `ipAddress` from params and automatically applies `label` to loggers.
 *
 * Provides the op a per-invocation `CurrentBansAndExcessiveActivities`
 * `prefetchedRowsRef` so the body can stash pre-check rows for the logger to
 * reuse (see _current-bans-and-excessive-activities.ts).
 *
 * Activity rows and their ban updates are security records, so a logging
 * failure never determines the op's outcome. The wrapper swallows it and
 * preserves the op's own success, failure, or defect. A side effect must
 * never retroactively fail work whose transaction has already committed.
 * Interruptions pass through untouched. `logOnSuccess`/`logOnFailure`
 * control which directions are logged at all.
 */
export function createOpsFn<Params, A extends object, E, R>({
	fn,
	label,
	logOnSuccess = true,
	logOnFailure = true,
}: {
	fn: (params: Params) => Effect.Effect<A, E, R>
	label: string
	logOnSuccess?: boolean
	logOnFailure?: boolean
}) {
	return (params: Params & OpsInvocationOptions) => {
		const _logOnSuccess = params.logOnSuccess ?? logOnSuccess
		const _logOnFailure = params.logOnFailure ?? logOnFailure

		return Effect.gen(function* () {
			const prefetchedRowsRef = yield* Ref.make<CurrentBansAndExcessiveActivitiesCtx>(null)

			return yield* fn(params).pipe(
				Effect.provideService(CurrentBansAndExcessiveActivitiesService, prefetchedRowsRef),
				Effect.tap((data: A & LoggingFields) =>
					_logOnSuccess
						? ignoreLoggingFailure(
								logSuccessfulActivity({
									anonId: params.anonId,
									userId: params.userId,
									...data.logging,
									label,
									ipAddress: params.ipAddress,
								}),
							)
						: Effect.void,
				),
				Effect.tapError((cause: unknown) =>
					_logOnFailure
						? ignoreLoggingFailure(
								logFailedActivity({error: cause, label, ipAddress: params.ipAddress}),
							)
						: Effect.void,
				),
				/**
				 * Defects skip the failure channel, so log them and security records are
				 * not lost. tapDefect hands the full Cause (never a typed failure), so
				 * the UNKNOWN branch always applies here. Server-side defects are not
				 * user behavior: weight 0 so they cannot feed ban thresholds
				 */
				Effect.tapDefect((cause: unknown) =>
					_logOnFailure
						? ignoreLoggingFailure(
								logFailedActivity({
									error: cause,
									label,
									ipAddress: params.ipAddress,
									weight: 0,
								}),
							)
						: Effect.void,
				),
				/**
				 * Catch unknown errors from leaking to users, preserving root props for
				 * diagnostics. Ops errors conforming to the [ops-error contract] {@link (file://./ops-error.ts)}
				 * pass through untouched; everything else is wrapped
				 * into a generic INTERNAL_ERROR.
				 */
				Effect.catch((error): Effect.Effect<never, E | OpsErrorContract> => {
					if (isOpsError(error)) return Effect.fail(error)
					return Effect.fail(
						opsFailure({
							failureCause: 'INTERNAL_ERROR',
							rateAllowance: Infinity,
							meta: extractErrorProps(error),
							message: 'Something went wrong. Please try again later.',
						}),
					)
				}),
				/** Traces the whole op, body plus logging taps, under the op's label */
				Effect.withSpan(label),
			)
		})
	}
}

/** Create an ops function for system operations. Automatically applies ip address of 0.0.0.0 if not defined */
export function createSystemOpsFn<Params, A extends object, E, R>(args: {
	fn: (params: Params) => Effect.Effect<A, E, R>
	label: string
	logOnSuccess?: boolean
	logOnFailure?: boolean
}) {
	return (_args: Params & Partial<OpsInvocationOptions>) =>
		createOpsFn(args)({..._args, ipAddress: _args.ipAddress ?? '0.0.0.0'})
}

import {Cause, Schema, Struct} from 'effect'

import {
	EXCESSIVE_ACTIVITIES_THRESHOLD,
	ACTIVITIES_BASELINE_WEIGHT,
} from '#/db/models/activities/consts.ts'
import {InsertFailureVariant} from '#/db/models/activities/validations.ts'

/**
 * The activity payload ops errors carry: the insert data for the failure's
 * security record (failureCause, weight, entity ids). Shared by every ops
 * error so generic code (`createOpsFn`, `logFailedActivity`) persists it
 * without domain knowledge.
 */
const OpsErrorActivityPayload = InsertFailureVariant.mapFields(
	Struct.omit(['label', 'success', 'ipAddress']),
).mapFields(Struct.evolve({weight: () => Schema.Int}))

/**
 * The ops-error contract: a Struct rather than a Class, because generic code
 * (createOpsFn's sanitizer, logFailedActivity, sanitizeErrors) must recognize
 * any conforming error by structural shape, not by class identity. The
 * conformers are OpsError, RateLimitError, and ops' own duck-typed
 * TaggedErrorClass subclasses. Classes are the conformers; this Struct is the
 * contract they conform to.
 *
 * An error conforming to this shape, a valid activity payload plus a
 * client-safe message, is an anticipated ops failure, treated as first-class
 * everywhere generic code handles errors:
 *
 * - preserved (not wrapped) by the `createOpsFn` error sanitizer
 * - persisted with its own activity data by `logFailedActivity`
 * - surfaced with its own message by `sanitizeErrors` at the HTTP boundary
 * - inspectable by `runOp` recovery hooks
 *
 * `OpsError` is the generic built-in conformer, and ops declare their own
 * tagged classes when a classifier must react to a failure by type.
 * Conformers opt in by implementing the shape, with no generic-file edits:
 *
 * ```ts
 * export class FlagNotFoundError extends Schema.TaggedErrorClass<FlagNotFoundError>()(
 * 	'FlagNotFoundError',
 * 	OpsErrorSchema,
 * ) {}
 * ```
 */
export const OpsErrorSchema = Schema.Struct({
	activity: OpsErrorActivityPayload,
	message: Schema.String,
})

/** The decoded contract any conforming ops error satisfies. */
export type OpsErrorContract = (typeof OpsErrorSchema)['Type']

/** Structural conformance test: is this error any ops error (of any kind)? */
export const isOpsError = (cause: unknown): cause is OpsErrorContract =>
	Schema.is(OpsErrorSchema)(cause)

/**
 * The generic ops error: an anticipated failure carrying its own audit
 * payload and a client-safe message. Ops construct it directly for expected
 * failures (`failureCause` is free-form audit vocabulary); the framework also
 * wraps unknown errors into it as `INTERNAL_ERROR` (see `createOpsFn`).
 */
export class OpsError extends Schema.TaggedErrorClass<OpsError>()('OpsError', OpsErrorSchema) {}

/** Flattened Ops Error schema for failures sugar */
export type OpsFailureFields = Omit<(typeof OpsErrorActivityPayload)['Type'], 'weight'> & {
	readonly rateAllowance?: number
	readonly message?: string
}

/** Calculate an activity's weight for a given maxAllowedPerWindow. */
export const allowRatePerWindow = (maxAllowedPerWindow: number) => {
	if (maxAllowedPerWindow <= 0) throw new Error('maxAllowedPerWindow must be a positive integer')
	return Math.ceil(EXCESSIVE_ACTIVITIES_THRESHOLD / maxAllowedPerWindow)
}

/**
 * Factory to create syntactic sugar for OpsErrors. `rateAllowance` defaults to
 * the [ACTIVITIES_BASELINE_WEIGHT]{@link (file://./../models/activities/consts.ts)}
 * For why the `as InstanceType<E>` assertion is needed, see the SAFETY note below.
 */
export const createOpsFailure =
	<E extends new (fields: OpsErrorContract) => OpsErrorContract>(FailureError: E) =>
	({
		message = 'Something went wrong.',
		rateAllowance,
		...activity
	}: OpsFailureFields): InstanceType<E> => {
		// SAFETY: TS cannot express "constructor of a Schema.TaggedErrorClass subclass
		// whose instance type extends OpsErrorContract" without a self-referencing
		// constraint, so the fields are checked against OpsErrorContract and the
		// bridge to the caller's exact class is asserted once here.
		return new FailureError({
			activity: {
				...activity,
				weight:
					rateAllowance !== undefined // 0 must not fall-through to the default
						? allowRatePerWindow(rateAllowance)
						: ACTIVITIES_BASELINE_WEIGHT,
			},
			message,
		}) as InstanceType<E>
	}

/** Sugar for Errors to use in ops functions */
export const opsFailure = createOpsFailure(OpsError)

function isCause(cause: unknown): cause is Cause.Cause<unknown> {
	return cause instanceof Object && 'reasons' in cause && Array.isArray(cause.reasons)
}

/** A primitive displayable failure value. Stringified for diagnostics, never an object. */
const DisplayableFailure = Schema.Union([
	Schema.String,
	Schema.Number,
	Schema.Boolean,
	Schema.BigInt,
])

/** Safe diagnostic props extracted from a failure; every value is a client-safe string. */
export type ExtractedErrorProps = {
	name?: string
	message?: string
	failure?: string
	defectCount?: string
	value?: string
}

/**
 * Formats errors into safe metadata: error name and message, primitive
 * failure values, and a defect count. Raw causes, defect values, SQL
 * parameters, and token payloads are stripped
 */
export function extractErrorProps(cause: unknown): ExtractedErrorProps {
	if (isCause(cause)) {
		const failure = Cause.findErrorOption(cause)
		const failureValue = failure._tag === 'Some' ? failure.value : undefined
		const failureName = failureValue instanceof Error ? failureValue.name : undefined
		const failureMessage = failureValue instanceof Error ? failureValue.message : undefined
		const failureFallback =
			failureValue !== undefined &&
			!(failureValue instanceof Error) &&
			Schema.is(DisplayableFailure)(failureValue)
				? String(failureValue)
				: undefined
		const defectCount = cause.reasons.filter(Cause.isDieReason).length
		const props: ExtractedErrorProps = {}
		if (failureName !== undefined) props.name = failureName
		if (failureMessage !== undefined) props.message = failureMessage
		if (failureFallback !== undefined) props.failure = failureFallback
		if (defectCount > 0) props.defectCount = String(defectCount)
		return props
	}
	if (cause instanceof Error) {
		return {name: cause.name, message: cause.message}
	}
	return {value: String(cause)}
}

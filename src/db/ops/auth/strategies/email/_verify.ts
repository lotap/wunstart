import {Effect} from 'effect'

import * as emailVerificationsCascades from '#/db/models/email-verifications/cascades.ts'
import * as emailVerificationsQueries from '#/db/models/email-verifications/queries.ts'
import {isTransientPgError} from '#/db/ops/_extract-pg-error.ts'
import {retryRollbackSafeDb, retryTransientDb} from '#/db/ops/_retry.ts'
import {verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'

import {
	INVALID_PASSCODE_MESSAGE,
	TOO_MANY_PASSCODE_ATTEMPTS_MESSAGE,
	WRONG_PASSCODE_MESSAGE,
} from './_messages.ts'
import {PASSCODE_MAX_ATTEMPTS} from './consts.ts'

const archiveWithPasscode = (input: {id: string; passcodeHash: string}) =>
	emailVerificationsCascades.archiveWithPasscode(input).pipe(
		retryTransientDb,
		Effect.catchTags({
			ArchiveNotFoundError: () => Effect.void,
			ArchiveCountMismatchError: () => Effect.void,
		}),
		/**
		 * Only transient SqlErrors that survived retries are swallowed (the row is
		 * logically dead regardless). Non-retryable ones such as constraint
		 * violations and schema drift propagate so they surface as internal errors
		 */
		Effect.catchIf(isTransientPgError, () => Effect.void),
	)

/**
 * Verifies a passcode against the unexpired verification row.
 *
 * Runs outside any caller transaction, and reserves the attempt in the database before
 * hashing: a burst of concurrent guesses must not share one read of the row attempt counter and
 * reach the hash together. The row counter therefore survives every failure path, including a
 * crash between the reservation and the hash, which consumes the attempt. On success the row
 * data is returned for the caller to burn
 */
export const verify = Effect.fn('emailVerify')(function* (
	input: {email: string; passcode: string} & (
		| {anonId: string; userId?: null; anonRegistered: boolean}
		| {anonId?: null; userId: string}
	),
) {
	const {email, passcode, anonId, userId} = input

	/**
	 * The activities `anonId` column is a FK to anons.id, and only registered anons
	 * have a row. Unregistered anon tokens must never populate the column.
	 */
	const entityIds =
		'anonRegistered' in input
			? {anonId: input.anonRegistered ? anonId : undefined, userId: null}
			: {anonId: null, userId}

	/** Select the unexpired verification row */
	const [verification] = yield* emailVerificationsQueries
		.selectFromUnexpiredByEmailAndEntityId(input)
		.pipe(retryTransientDb)

	if (!verification)
		return yield* opsFailure({
			...entityIds,
			failedCredential: email,
			failureCause: 'NOT_FOUND_OR_EXPIRED',
			rateAllowance: 6,
			message: INVALID_PASSCODE_MESSAGE,
		})

	const {id, attempts, passcodeHash} = verification

	/** Check if already at max attempts */
	if (attempts >= PASSCODE_MAX_ATTEMPTS) {
		/**
		 * Retire the dead row, guarded by its passcode hash so a concurrent new-code
		 * reset cannot be clobbered. This runs in its own transaction and no caller
		 * transaction is open at this point. Absence is not an error
		 */
		yield* archiveWithPasscode({id, passcodeHash})

		return yield* opsFailure({
			...entityIds,
			failedCredential: email,
			failureCause: 'MAX_ATTEMPTS',
			meta: {id},
			rateAllowance: 4,
			message: TOO_MANY_PASSCODE_ATTEMPTS_MESSAGE,
		})
	}

	/**
	 * Reserve the attempt before hashing. The update is the concurrency gate: Postgres
	 * evaluates its `attempts < maxAttempts` guard against the current row, so concurrent
	 * guesses each consume a slot instead of all reading the same count and reaching the
	 * hash. The remaining guards restrict it to the same, still-unexpired code generation
	 * and entity, so a concurrent new-code reset or burn cannot be overwritten. A crash
	 * between this statement and the hash consumes the reserved attempt (fail-closed)
	 */
	const [incrementedRow] = yield* emailVerificationsQueries
		.incrementAttempts({
			...input,
			id,
			passcodeHash,
			maxAttempts: PASSCODE_MAX_ATTEMPTS,
		})
		.pipe(retryRollbackSafeDb)

	if (!incrementedRow)
		/**
		 * The reservation was refused: the row was exhausted, burned, reset, or expired
		 * between the select and the update. No attempt was reserved, so nothing is hashed
		 */
		return yield* opsFailure({
			...entityIds,
			failedCredential: email,
			failureCause: 'RESERVATION_REFUSED',
			meta: {id},
			rateAllowance: 4,
			message: INVALID_PASSCODE_MESSAGE,
		})

	return yield* Effect.gen(function* () {
		/** Compare the passcode with the hash read by the select; the reservation above already counts this attempt */
		const isValid = yield* verifyTarget(passcodeHash, passcode)

		if (!isValid) {
			/**
			 * The cap applies only to a mismatch: a correct submission succeeds even
			 * when its reservation consumed the last allowed attempt
			 */
			if (incrementedRow.attempts >= PASSCODE_MAX_ATTEMPTS) {
				/**
				 * Last allowed attempt used. Retire the dead row, guarded by its passcode hash
				 * so a concurrent reset cannot be clobbered. A concurrent correct submission
				 * may have burned it first, so its absence is not an error
				 */
				yield* archiveWithPasscode({id, passcodeHash})

				return yield* opsFailure({
					...entityIds,
					failedCredential: email,
					failureCause: 'MAX_ATTEMPTS',
					meta: {id},
					rateAllowance: 4,
					message: TOO_MANY_PASSCODE_ATTEMPTS_MESSAGE,
				})
			}

			return yield* opsFailure({
				...entityIds,
				failedCredential: email,
				failureCause: 'WRONG_CODE',
				meta: {id},
				rateAllowance: 12,
				message: WRONG_PASSCODE_MESSAGE,
			})
		}

		return {id, passcodeHash}
	}).pipe(
		// oxlint-disable-next-line effecttsgo/strict-effect-provide
		Effect.provide(HashingStub.layer(userId ?? anonId)),
	)
})

import {Effect} from 'effect'

import * as emailVerificationsCascades from '#/db/models/email-verifications/cascades.ts'
import * as emailVerificationsQueries from '#/db/models/email-verifications/queries.ts'
import {isTransientPgError} from '#/db/ops/_extract-pg-error.ts'
import {retryRollbackSafeDb, retryTransientDb} from '#/db/ops/_retry.ts'
import {verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'

const MAX_ATTEMPTS = 4

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
 * Runs outside any caller transaction. On a wrong code the failed attempt is persisted
 * (attempt counters must survive the logical failure) before the {@link OpsError} is raised.
 * On success the row data is returned for the caller to burn
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
			message: 'That code is no longer valid. Request a fresh one.',
		})

	const {id, attempts, passcodeHash} = verification

	/** Check if already at max attempts */
	if (attempts >= MAX_ATTEMPTS) {
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
			message: 'Too many tries. Request a fresh code to start over.',
		})
	}

	return yield* Effect.gen(function* () {
		/** Verify the passcode against the stored hash */
		const isValid = yield* verifyTarget(passcodeHash, passcode)

		if (!isValid) {
			/**
			 * Wrong passcode. Increment attempts
			 *
			 * Only applies to the same, still-unexpired code generation and never past MAX_ATTEMPTS,
			 * so a new-code reset or a concurrent burn cannot be overwritten.
			 */
			const [incrementedRow] = yield* emailVerificationsQueries
				.incrementAttempts({
					...input,
					id,
					passcodeHash,
					maxAttempts: MAX_ATTEMPTS,
				})
				.pipe(retryRollbackSafeDb)

			if (!incrementedRow)
				/** A concurrent burn or new-code reset invalidated the row before the increment applied */
				return yield* opsFailure({
					...entityIds,
					failedCredential: email,
					failureCause: 'NOT_FOUND_ON_INCREMENT',
					meta: {id},
					rateAllowance: 4,
					message: 'That code is no longer valid. Request a fresh one.',
				})

			if (incrementedRow.attempts >= MAX_ATTEMPTS) {
				/**
				 * Max reached. Retire the dead row, guarded by its passcode hash so a
				 * concurrent reset cannot be clobbered. A concurrent correct submission
				 * may have burned it first, so its absence is not an error
				 */
				yield* archiveWithPasscode({id, passcodeHash})

				return yield* opsFailure({
					...entityIds,
					failedCredential: email,
					failureCause: 'MAX_ATTEMPTS',
					meta: {id},
					rateAllowance: 4,
					message: 'Too many tries. Request a fresh code to start over.',
				})
			}

			return yield* opsFailure({
				...entityIds,
				failedCredential: email,
				failureCause: 'WRONG_CODE',
				meta: {id},
				rateAllowance: 12,
				message: 'That code isn’t right. Double-check it and try again.',
			})
		}

		return {id, passcodeHash}
	}).pipe(Effect.provide(HashingStub.layer(userId ?? anonId)))
})

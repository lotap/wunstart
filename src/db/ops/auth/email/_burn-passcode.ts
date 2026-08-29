import {DateTime, Effect} from 'effect'

import type {Tx} from '#/db/helpers/types.ts'
import * as emailVerificationsQueries from '#/db/models/email-verifications/queries.ts'
import {archiveTable} from '#/db/models/email-verifications/schemas.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'

import type {verify} from './_verify.ts'

/**
 * Burns a successfully verified passcode and moves the row to the archive table
 * inside the caller's transaction. The conditional delete re-checks the row's code
 * generation and expiry, so concurrent correct submissions cannot both burn the
 * same passcode and a new-code reset cannot be burned by an in-flight verification
 * of the old code.
 */
export const burnPasscode = Effect.fn('emailVerifyBurnPasscode')(function* ({
	verification: {id, passcodeHash},
	email,
	tx,
	...identityIds
}: {
	verification: Effect.Success<ReturnType<typeof verify>>
	email: string
	tx: Tx
} & ({anonId: string} | {userId: string} | {anonId: string; userId: string})) {
	const [row] = yield* emailVerificationsQueries.deleteFromUnexpiredWithPasscodeAndEntityId(
		{id, passcodeHash, ...identityIds},
		tx,
	)

	if (!row)
		return yield* opsFailure({
			...identityIds,
			failedCredential: email,
			failureCause: 'NOT_FOUND_OR_EXPIRED',
			rateAllowance: 6,
			message: 'That code is no longer valid. Request a fresh one.',
		})

	yield* tx
		.insert(archiveTable)
		.values({...row, ...identityIds, verifiedAt: DateTime.toDate(yield* DateTime.now)})
})

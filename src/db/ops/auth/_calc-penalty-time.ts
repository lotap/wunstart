import {EXCESSIVE_ACTIVITIES_THRESHOLD} from '#/db/models/activities/consts.ts'
import {
	PENALTY_INTERVAL_INITIAL,
	PENALTY_INTERVAL_INITIAL_QTY,
	PENALTY_INTERVAL_MAX_QTY,
	PENALTY_INTERVAL_UNIT,
} from '#/db/models/bans/consts.ts'

/**
 * Exponentially increase the penalty time based on the total weight of activities
 *
 * This also means that if a "heavy" activity tips the total weight over the threshold,
 * then the calculated penalty will reflect that.
 * Eg with threshold: 60 & initial interval: 10 minutes
 * - if the total weight is 60, the calculated penalty will be 10 minutes
 * - if the total weight is 75, the calculated penalty will be ~12 minutes
 * - if the total weight is 90, the calculated penalty will be ~14 minutes
 * - if the total weight is 180, the calculated penalty will be ~40 minutes
 * - if the total weight is 275, the calculated penalty will be ~2 hours
 */
export function calculatePenaltyTime(totalWeight: bigint | null) {
	if (totalWeight === null) return PENALTY_INTERVAL_INITIAL
	if (totalWeight > Number.MAX_SAFE_INTEGER || totalWeight < Number.MIN_SAFE_INTEGER)
		return `${PENALTY_INTERVAL_MAX_QTY} ${PENALTY_INTERVAL_UNIT}`
	/**
	 * 2^0 = 1, so the calculated time equals the initial penalty time exactly at the threshold.
	 *
	 * The inner Math.min caps the exponent at 5 to bound the exponentiation;
	 * PENALTY_INTERVAL_MAX_QTY usually binds first (120 min with the current
	 * constants, where 2^5 on a 10 min initial interval would give ~320 min).
	 */
	return `${Math.min(
		Math.ceil(
			PENALTY_INTERVAL_INITIAL_QTY *
				Math.pow(2, Math.min(Number(totalWeight) / EXCESSIVE_ACTIVITIES_THRESHOLD - 1, 5)),
		),
		PENALTY_INTERVAL_MAX_QTY,
	)} ${PENALTY_INTERVAL_UNIT}`
}

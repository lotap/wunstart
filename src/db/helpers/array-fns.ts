/**
 * Append `next` to `existing`, moving a re-appearance to the end, and keep only
 * the last `max` unique values. A null `next` appends nothing but still trims.
 * A non-positive `max` keeps nothing.
 *
 * Duplicates already present in `existing` resolve to their last occurrence, so
 * the result agrees with `appendUniqueBoundedSql`: the final element is always
 * the most recent value.
 */
export const appendUniqueBounded = (
	existing: readonly string[] | undefined,
	next: string | null,
	max: number,
): string[] => {
	if (max <= 0) return []

	const set = new Set(
		existing?.filter((value, index) => existing.lastIndexOf(value) === index) ?? [],
	)

	if (next) {
		set.delete(next)
		set.add(next)
	}

	return [...set].slice(-max)
}

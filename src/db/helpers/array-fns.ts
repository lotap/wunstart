/**
 * Append `next` to `existing`, moving a re-appearance to the end, and keep only
 * the last `max` unique values. A null `next` appends nothing but still trims.
 *
 * JavaScript counterpart to `appendUniqueBoundedSql`; keep the ordering and cap
 * semantics aligned.
 */
export const appendUniqueBounded = (
	existing: readonly string[] | undefined,
	next: string | null,
	max: number,
): string[] => {
	const set = new Set(existing)

	if (next) {
		set.delete(next)
		set.add(next)
	}

	return [...set].slice(-max)
}

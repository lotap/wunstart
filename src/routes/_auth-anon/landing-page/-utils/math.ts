/** Clamp a value to the given range. */
export function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max)
}

/** Clamp a value to the 0–1 range. */
export function clamp01(value: number) {
	return clamp(value, 0, 1)
}

/** Compare two progress arrays with a tolerance below a visible frame step. */
export function progressDiffers(next: ReadonlyArray<number>, previous: ReadonlyArray<number>) {
	if (next.length !== previous.length) return true

	return next.some((value, index) => Math.abs(value - (previous[index] ?? -1)) > 0.001)
}

import {clamp01} from './math.ts'

/**
 * Cubic ease-out for scroll-linked reveals. Starts quickly, then settles.
 * Input and output are normalized to 0–1.
 */
export function easeOut(value: number) {
	return 1 - (1 - clamp01(value)) ** 3
}

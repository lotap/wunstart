/** Default AVIF ladder for `?responsive` image imports. */
export const STATIC_IMAGE_WIDTHS: ReadonlyArray<number> = [400, 640, 960, 1280, 1536, 1920, 2560]

/** Default upper bound; `?maxWidth=3840&responsive` opts into 4K output. */
export const STATIC_IMAGE_MAX_WIDTH = 2560

/** Default AVIF quality; override per image with `?avifQuality=`. */
export const STATIC_IMAGE_AVIF_QUALITY = 55

/**
 * Directives accepted before the final `?responsive` marker. Keep this narrow:
 * unknown imagetools options must fail the build instead of silently changing
 * the output format or transform pipeline.
 */
const SUPPORTED_DIRECTIVES: ReadonlySet<string> = new Set([
	'responsive',
	'maxWidth',
	'w',
	'avifQuality',
])

/** Intrinsic widths below this need a 5% gain before becoming their own variant. */
const STATIC_IMAGE_NATIVE_MIN_WIDTH = 1080

/**
 * Output shape of a `?responsive` image import. `src` is the largest generated
 * variant, `w`/`h` are its intrinsic dimensions, and `srcset` is absent when the
 * source produced a single variant.
 */
export type StaticImageData = {
	src: string
	w: number
	h: number
	srcset?: string
}

/**
 * Builds the width list for one image. Rungs above the source width are
 * dropped, so small images never upscale. Intrinsic widths from 1080 through
 * the cap are kept; below 1080 they only earn a variant when they add at least
 * 5% over the previous rung.
 */
export function staticImageWidths(width: number, maxWidth: number): Array<number> {
	const widths: Array<number> = STATIC_IMAGE_WIDTHS.filter(
		(rung) => rung < width && rung <= maxWidth,
	)

	const last: number | undefined = widths.at(-1)

	if (width <= maxWidth) {
		const keepNative: boolean =
			width >= STATIC_IMAGE_NATIVE_MIN_WIDTH ||
			widths.length === 0 ||
			(last !== undefined && width > last * 1.05)

		if (keepNative) widths.push(width)
	} else if (maxWidth > (last ?? 0)) {
		widths.push(maxWidth)
	}

	if (widths.length === 0) widths.push(Math.min(width, maxWidth))

	return widths
}

/** Rejects anything outside the documented directive set before imagetools sees it. */
function assertSupportedDirectives(url: URL): void {
	for (const key of url.searchParams.keys()) {
		if (!SUPPORTED_DIRECTIVES.has(key)) {
			throw new Error(
				`Unsupported directive ${JSON.stringify(key)} on a ?responsive image import — use only ?maxWidth, ?w, or ?avifQuality before the final ?responsive marker.`,
			)
		}
	}
}

/** Parses `?avifQuality=`; defaults to 55 and rejects values outside 1–100. */
export function parseAvifQuality(value: string | null): number {
	if (value === null) return STATIC_IMAGE_AVIF_QUALITY

	const parsed: number = Number.parseInt(value, 10)

	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100 || String(parsed) !== value) {
		throw new Error(
			`Invalid avifQuality ${JSON.stringify(value)} on a ?responsive image import — use an integer from 1 to 100.`,
		)
	}

	return parsed
}

export function parseMaxWidth(value: string | null): number {
	if (value === null) return STATIC_IMAGE_MAX_WIDTH

	const parsed: number = Number.parseInt(value, 10)

	if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== value) {
		throw new Error(
			`Invalid maxWidth ${JSON.stringify(value)} on a ?responsive image import — use a positive integer.`,
		)
	}

	return parsed
}

/** Rejects comma-separated or otherwise malformed `?w=` values before imagetools sees them. */
export function parseWidths(value: string): void {
	for (const part of value.split(';')) {
		const parsed: number = Number.parseInt(part, 10)

		if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== part) {
			throw new Error(
				`Invalid w ${JSON.stringify(value)} on a ?responsive image import — use semicolon-separated positive integers.`,
			)
		}
	}
}

/**
 * Resolves directives for a marked image. The plugin's `include` filter is the
 * actual gate for imports; this guard keeps the resolver safe when it is called
 * directly, and avoids adding directives if that filter is ever widened.
 *
 * Only the documented directives are accepted. `?avifQuality=` is mapped to
 * imagetools’ `quality` and removed from the URL, so the format-specific name
 * stays out of the generated config.
 */
export async function staticImageDirectives(
	url: URL,
	getMetadata: () => {width?: number} | Promise<{width?: number}>,
): Promise<URLSearchParams> {
	if (!url.searchParams.has('responsive')) return new URLSearchParams()

	assertSupportedDirectives(url)

	const avifQuality: number = parseAvifQuality(url.searchParams.get('avifQuality'))

	url.searchParams.delete('avifQuality')

	const directives = new URLSearchParams({
		as: 'img',
		format: 'avif',
		quality: String(avifQuality),
	})

	// An explicit width list is a full replacement.
	const explicitWidths: string | null = url.searchParams.get('w')

	if (explicitWidths !== null) {
		parseWidths(explicitWidths)

		return directives
	}

	const {width} = await getMetadata()

	if (width === undefined || width <= 0) return directives

	const maxWidth: number = parseMaxWidth(url.searchParams.get('maxWidth'))

	directives.set('w', staticImageWidths(width, maxWidth).join(';'))

	return directives
}

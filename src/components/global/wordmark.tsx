import WordmarkSvg from '#/assets/images/brand/wordmark.svg?react'

/**
 * Inline brand mark. The starter artwork is monochrome so it can inherit
 * `currentColor` and blend into whatever surface it sits on; a replacement SVG
 * keeps its own fills. A raster replacement needs the `?url` import and an
 * `<img>`; keep the wrapping link’s accessible name.
 */
export function Wordmark({className}: {className?: string}) {
	return <WordmarkSvg className={className} aria-hidden="true" />
}

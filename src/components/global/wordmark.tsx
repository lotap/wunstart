import WordmarkSvg from '#/assets/images/brand/wordmark.svg?react'

/**
 * Inline brand mark. The starter artwork is monochrome so it can inherit
 * `currentColor` and blend into the footer; a replacement SVG keeps its own
 * fills.
 *
 * Replace `src/assets/images/brand/wordmark.svg` to change the mark. For a
 * raster logo, swap the import for `?url` and render an `<img>` here; keep the
 * wrapping link’s accessible name.
 */
export function Wordmark({className}: {className?: string}) {
	return <WordmarkSvg className={className} aria-hidden="true" />
}

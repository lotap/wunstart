/**
 * Apple WebKit paints magenta edges around text layers while a blur filter is
 * active. Keep blur animations in other engines and let opacity and transform
 * carry the animation there.
 */
export const supportsTextBlur = globalThis.navigator.vendor !== 'Apple Computer, Inc.'

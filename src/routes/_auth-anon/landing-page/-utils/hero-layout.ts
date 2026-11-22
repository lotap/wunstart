import {HERO_FEATURES, HERO_WORDS} from '../-content/hero.ts'

/** Short lead-in before the first swap, in viewport heights. */
export const FIRST_WORD_VH = 20

/** Distance from the viewport top where the headline pins, in viewport heights. */
export const STICKY_TOP_VH = 10

/** Scroll distance each word after the first holds, in viewport heights. */
export const SCROLL_PER_WORD_VH = 30

/** Extra runway after the last word so it settles before the headline releases. */
const LAST_WORD_SETTLE_VH = 10

/**
 * Pinned scroll runway for the headline, in viewport heights. The last word
 * lands slightly before the headline release so it has time to settle.
 */
export const RUNWAY_VH =
	FIRST_WORD_VH + (HERO_WORDS.length - 2) * SCROLL_PER_WORD_VH + LAST_WORD_SETTLE_VH

/** Scroll distance from load to the headline release, in viewport heights. */
export const WORD_MAPPING_DISTANCE_VH = 100

/** Top of the shader sticky layer, in viewport heights. */
export const SHADER_STICKY_TOP_VH = 30

/** Bottom of the shader sticky layer, in viewport heights. */
const SHADER_STICKY_BOTTOM_VH = 80

/** Sticky height of the shader layer, in viewport heights. */
export const SHADER_STICKY_HEIGHT_VH = SHADER_STICKY_BOTTOM_VH - SHADER_STICKY_TOP_VH

/** Extra shader canvas above and below the sticky layer, in viewport heights. */
export const SHADER_INSET_VH = 30

/** Scroll distance from the last word to the subline being fully visible. */
export const FEATURES_TEXT_IN_VH = 10

/** Scroll distance over which the desktop hero prompt fades once the subline pins, in viewport heights. */
export const PROMPT_FADE_VH = 12

/** Viewport width below which the hero uses its stacked mobile layout, in pixels. */
export const MOBILE_MAX_WIDTH_PX = 640

/** Scroll distance over which the headline fades after the subline is visible. */
export const HEADLINE_FADE_VH = 40

/**
 * Document offset of the features text block, in viewport heights. The whole
 * headline/subline unit is lifted together, keeping their original spacing.
 */
export const FEATURES_TEXT_BLOCK_TOP_VH = 139

/**
 * Top inset where the features text pins, in pixels. A little air above the
 * line, then it rides the site bar’s visible height (`--header-dock`) so the
 * revealed bar never clips it.
 */
export const FEATURES_TEXT_STICKY_TOP_PX = 40

/** Lead below the pinned subline where the shader curtain starts releasing, in viewport heights. */
export const SHADER_RELEASE_LEAD_VH = 4

/** Document offset of the feature boxes block, in viewport heights. */
export const BOXES_BLOCK_TOP_VH = 200

/** Rough subline height before the hook measures it, in viewport heights. */
const INITIAL_SUBLINE_HEIGHT_VH = 9

/**
 * Initial height of the shader sticky parent. The scroll hook replaces this
 * with the measured subline height so the shader releases as the subline
 * starts leaving.
 */
export const SHADER_PARENT_HEIGHT_CSS = `calc(${
	BOXES_BLOCK_TOP_VH -
	(INITIAL_SUBLINE_HEIGHT_VH + SHADER_RELEASE_LEAD_VH) +
	SHADER_STICKY_TOP_VH +
	SHADER_STICKY_HEIGHT_VH
}svh - ${FEATURES_TEXT_STICKY_TOP_PX}px)`

/**
 * Sticky runway past the first box top. The text stays pinned until the first
 * card reaches its bottom, so the container must outlive that handoff.
 */
const FEATURES_TEXT_STICKY_TAIL_VH = 20

/** Height of the sticky features text container, in viewport heights. */
export const FEATURES_TEXT_STICKY_HEIGHT_VH =
	BOXES_BLOCK_TOP_VH - FEATURES_TEXT_BLOCK_TOP_VH + FEATURES_TEXT_STICKY_TAIL_VH

/** Card height and gap in rem, used by the feature list and the section height. */
export const FEATURE_CARD_HEIGHT_REM = 7
export const FEATURE_GAP_REM = 1

/** Height of the feature stack: one card per feature plus the gaps between them. */
const FEATURE_STACK_HEIGHT_REM =
	HERO_FEATURES.length * FEATURE_CARD_HEIGHT_REM + (HERO_FEATURES.length - 1) * FEATURE_GAP_REM

/**
 * Section height ends exactly at the bottom of the feature stack, so the last
 * card is gone when the next section arrives.
 */
export const SECTION_HEIGHT_CSS = `calc(${BOXES_BLOCK_TOP_VH}svh + ${FEATURE_STACK_HEIGHT_REM}rem)`

/**
 * The headline keeps a `WORD_MAPPING_DISTANCE_VH` runway before it releases.
 * The section grows with the feature stack, so the sticky layer grows with it.
 */
export const HEADLINE_STICKY_HEIGHT_CSS = `calc(${WORD_MAPPING_DISTANCE_VH}svh + ${FEATURE_STACK_HEIGHT_REM}rem)`

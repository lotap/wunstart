# Static images

Build-time AVIF variants for committed images. `vite-imagetools` plus `sharp` run during Vite’s build; production serves ordinary static files.

## Placement

- Route- or component-private images: `-images/` beside the owner. The `-` prefix keeps the folder out of the route tree, so deleting the owner deletes its images.
- Shared images: `src/assets/images/<domain>/` (`brand/`, `auth/`).
- Promote on the second consumer, matching component promotion.
- `public/` is only for stable-URL or unprocessed files. It is outside the image pipeline: `?responsive` has no effect, and files are referenced at the root URL. Content images belong in `src` so the build can hash and optimize them.

```
src/routes/_auth-anon/landing-page/
├── route.tsx
├── -images/hero.jpg
└── -components/...

src/assets/images/
└── brand/logo.png
```

## Import

The `?responsive` marker is the opt-in and must be the last query parameter. Without it, the import remains a normal Vite URL asset.

```tsx
import {StaticImage} from '#/components/global/static-image.tsx'
import hero from './-images/hero.jpg?responsive'
import logo from '#/assets/images/brand/logo.png?responsive'

<StaticImage
  image={hero}
  alt="A short description"
  sizes="(width < 64rem) 100vw, 50vw"
/>
```

`StaticImage` lives in `components/global/static-image.tsx`. Required: `image`, `alt`, `sizes`. It renders the fallback `src`, `srcSet`, and intrinsic `width`/`height`; defaults are `loading="lazy"` and `decoding="async"`. Use `loading="eager"` and `fetchPriority="high"` for the LCP image. Decorative images use `alt=""`.

The import shape is `{src, w, h, srcset?, placeholder?}` (`srcset` is absent for a single variant). Type declarations for `*?responsive` and `*&responsive` live in `vite-env.d.ts`. JPEG, PNG, and WebP work as sources. Animated GIFs are flattened to a still first frame; SVG icons stay normal imports.

## Placeholder

Each import carries a `placeholder` CSS background value sampled at build time from the source’s top and bottom rows. Close rows flatten to one color; different rows become `linear-gradient(top,bottom)` with no direction keyword (top to bottom is the default). It is tens of bytes, makes no request, and paints with the reserved box, so it never delays the image.

- Skip images with alpha and sources whose smallest variant is under 200 px.
- `StaticImage` applies it as `background`; a `style` prop overrides it, and `style={{background: 'none'}}` removes it.
- The sample is two pixels from a 1×2 resize, not a blur; a blurred LQIP is an opt-in upgrade.

## Ladder

```
400; 640; 960; 1280; 1536; 1920; 2560
```

- Never upscale.
- Intrinsic widths from 1080 through the cap are added even when they sit within 5% of a rung: exact rendering matters more at full width, and the extra variant is one file.
- Below 1080, a native width only earns a variant when it adds more than 5% over the previous rung; a 1000px source stays on the 960 rung, while 1080 becomes its own variant.
- 3840 is opt-in through `?maxWidth=3840`, not a default.
- A new width list is a build-policy change: update `src/lib/static-images.ts` and the docs together.

## Overrides

```tsx
// 4K / 2x-FHD hero: keep the default ladder and add a top rung
import banner from './-images/banner.jpg?maxWidth=3840&responsive'

// Card that never renders above 960
import card from './-images/card.jpg?maxWidth=960&responsive'

// Exact replacement for a thumbnail
import avatar from './-images/avatar.jpg?w=48;96&responsive'
```

- `?maxWidth=` caps the ladder. The cap becomes a top variant only when the source is wider than it; a narrower source is never upscaled. Native widths between 1080 and the cap are kept even when close to a rung; below 1080 the 5% rule applies.
- `?w=` replaces the whole ladder. A named width above the source collapses to the source width; nothing upscales. Use it for fixed-size assets such as the footer texture (`?w=1600`); raise that to `?w=1920;2560` if the halftone looks soft on high-DPI screens. A shader texture takes one URL, not a `srcset`, so the footer is deliberately single-variant. `?w=` cannot be combined with `?maxWidth=`.
- The marker stays last: `?w=1600&responsive`, never `?responsive&w=1600`.

## Quality

AVIF quality defaults to 55. Override it per image with `?avifQuality=` (integer 1–100):

```tsx
// Screenshot, diagram, or fine text where 55 smears detail
import screenshot from './-images/screenshot.png?avifQuality=70&responsive'
```

Quality is format-specific: the parameter is `?avifQuality`, not `?quality`, so a future WebP or JPEG output can add its own setting. Only `?maxWidth`, `?w`, and `?avifQuality` are accepted before the marker. Other imagetools directives, including `?quality` and `?format`, fail the build.

## `sizes`

`sizes` describes the rendered slot, not the file. The browser multiplies it by device pixel ratio, then picks the smallest sufficient `w` descriptor.

```
sizes="100vw"                                  // full-bleed
sizes="(width < 64rem) 100vw, 72rem"            // max-w-6xl content
sizes="(width < 64rem) 100vw, 50vw"             // half-width
sizes="8rem"                                    // fixed thumbnail
```

Keep `sizes` independent from the ladder. The ladder decides which files exist; `sizes` tells the browser which one to fetch.

## Build

- `vite-imagetools` is a dev dependency; `sharp` is native and runs during `vite build`. In dev, the full variant set for an image is generated when its module first loads, not one variant per request.
- `bunx tsc --noEmit` does not validate a `?responsive` path: the wildcard declarations in `vite-env.d.ts` match any specifier. Open the page or run `bun run build` after moving an image.
- Build and deploy where native `sharp` can execute. Never move image processing into the Worker runtime.
- Generated files are content-hash cached in `node_modules/.cache/imagetools`.
- AVIF only, enforced by the directive allowlist. There is no WebP or JPEG fallback.
- Production has no image cold start: variants are prebuilt static assets.

## Anti-patterns

- Importing a content image from `public/`.
- Adding `?responsive` to an image that never needs variants; plain imports stay URLs.
- Restating the full ladder for a 4K hero instead of `?maxWidth=3840`.
- Using the default ladder for a 48px avatar; use `?w=48;96`.
- Sharing a route-private image by importing another route’s `-images/` folder; promote it instead.
- Putting the marker before another query parameter.
- Combining `?w=` with `?maxWidth=`; they are alternatives.
- Assuming the type gate validates a `?responsive` path; it does not.
- Writing `?quality=` or `?format=`; the pipeline rejects both. Use `?avifQuality=` for AVIF.
- Editing generated AVIF files or committing build output.

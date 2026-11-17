import {ExternalDocLink} from '#/components/global/external-doc-link.tsx'
import {StaticImage} from '#/components/global/static-image.tsx'

import {CodeBlock} from '../../code-block.tsx'
import {DocDiagram} from '../../doc-diagram.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'
import rapids from './-images/rapids.jpg?responsive'

const usage = `import {StaticImage} from '#/components/global/static-image.tsx'
import rapids from './-images/rapids.jpg?responsive'

<StaticImage
  image={rapids}
  alt="Raging river rapids with white foam and dark water"
  sizes="18rem"
  className="w-full max-w-72 rounded-lg border"
/>`

const overrides = `// Let a 4K hero reach 3840
import banner from './-images/banner.jpg?maxWidth=3840&responsive'

// Never render this card above 960
import card from './-images/card.jpg?maxWidth=960&responsive'

// A thumbnail at exactly two widths
import avatar from './-images/avatar.jpg?w=48;96&responsive'

// Higher quality for a screenshot or fine text
import screenshot from './-images/screenshot.png?avifQuality=70&responsive`

const sizes = `sizes="100vw"                        // full-bleed
sizes="(width < 64rem) 100vw, 72rem"  // max-w-6xl content
sizes="(width < 64rem) 100vw, 50vw"   // half-width
sizes="8rem"                          // fixed thumbnail`

const buildPipelineChart = `flowchart LR
  entry["import ?responsive"] -->|"include filter"| plugin["vite-imagetools"]
  plugin -->|"source"| sharp{{"sharp"}}
  plugin -->|"metadata"| directives["staticImageDirectives"]
  directives -->|"?w · ?maxWidth · ?avifQuality"| sharp
  sharp -->|"AVIF · default quality 55 · no upscale"| variants["one variant per width"]`

const deliveryPipelineChart = `flowchart LR
  variants["AVIF variants"] -->|"dev"| dev["dev server · /@imagetools"]
  variants -->|"build"| prod["dist/client/assets · hashed"]
  dev --> img["StaticImage · srcSet + sizes"]
  prod -->|"Worker serves"| img
  img -->|"browser"| pick["smallest variant for slot x DPR"]`

const references = [
	{
		label: 'vite-imagetools',
		href: 'https://github.com/JonasKruckenberg/imagetools/blob/main/docs/directives.md',
	},
]

/** Topic docs for static images. The feature catalog links here instead of repeating it. */
export function StaticImagesPanel() {
	return (
		<>
			<PanelHeader
				title="Static images"
				description="Responsive AVIF variants for committed images."
			/>

			<PanelSection id="static-image-add" title="Adding an image">
				<Prose>
					Put private images in a <InlineCode>-images</InlineCode> folder near the page or component
					that uses them. Shared images go in <InlineCode>src/assets/images</InlineCode>. Both are
					optimized when imported with <InlineCode>?responsive</InlineCode>.
				</Prose>
				<CodeBlock code={usage} label="Responsive image usage" language="tsx" />
				<figure className="mt-4">
					<StaticImage
						image={rapids}
						alt="Raging river rapids with white foam and dark water"
						sizes="18rem"
						className="w-full max-w-72 rounded-lg border"
					/>
					<figcaption className="mt-2 max-w-sm text-sm text-muted-foreground">
						The snippet above, rendered from a 2400 px source. Photo by{' '}
						<ExternalDocLink href="https://unsplash.com/photos/raging-river-rapids-with-white-foam-and-dark-water-0kWMQnmLSms">
							Sebastian Schuster on Unsplash
						</ExternalDocLink>
					</figcaption>
				</figure>
				<Prose>
					<InlineCode>StaticImage</InlineCode> needs the imported image,{' '}
					<InlineCode>alt</InlineCode> text, and <InlineCode>sizes</InlineCode>. The marker and the{' '}
					<InlineCode>sizes</InlineCode> value are explained below.
				</Prose>
				<Prose>
					<InlineCode>public/</InlineCode> is not part of the pipeline. Vite does not process those
					files, so <InlineCode>?responsive</InlineCode> has no effect. Reference them at the root
					URL, and keep <InlineCode>public/</InlineCode> for stable-URL or unprocessed files.
				</Prose>
			</PanelSection>

			<PanelSection id="static-image-marker" title="The ?responsive marker">
				<Prose>
					The marker is the opt-in. It must be the last query parameter. Without it, Vite treats the
					file as an ordinary asset: no variants, no AVIF, only the original file as a normal Vite
					asset.
				</Prose>
				<Prose>
					With the marker, the import resolves into one AVIF file per width. Output is always AVIF;
					there is no WebP or JPEG fallback, and every current browser reads AVIF. JPEG, PNG, and
					WebP sources work; animated GIFs are flattened to a still frame, and SVG icons stay normal
					imports.
				</Prose>
				<Prose>
					The plugin reads the source, the resolver turns the width policy into a list, and sharp
					writes one file per width:
				</Prose>
				<figure>
					<figcaption className="text-sm font-medium text-muted-foreground">
						Build-time transform
					</figcaption>
					<div className="mt-2 rounded-xl border bg-muted/20 p-4">
						<DocDiagram
							source={buildPipelineChart}
							label="Static image build pipeline"
							idPrefix="static-image-build"
						/>
					</div>
				</figure>
			</PanelSection>

			<PanelSection id="static-image-widths" title="Widths and quality">
				<Prose>
					By default an image gets seven widths: 400, 640, 960, 1280, 1536, 1920, and 2560 px.
					Nothing is upscaled, so start with a source at least as wide as the largest variant you
					need. From 1080 px up a native width is kept even when it sits within 5% of a rung, so a
					1600 px source gets its own variant next to 1536; smaller sources only add a native width
					when it gains more than 5% over the previous rung.
				</Prose>
				<PanelList>
					<PanelRow label="?maxWidth">
						Caps the ladder at that width and adds it as a variant when the source is wider. Use{' '}
						<InlineCode>?maxWidth=3840</InlineCode> for a 4K hero or{' '}
						<InlineCode>?maxWidth=960</InlineCode> for a card that never renders wider. Cannot be
						combined with <InlineCode>?w</InlineCode>.
					</PanelRow>
					<PanelRow label="?w">
						Replaces the ladder with the widths you name. Widths above the source collapse to the
						source, so nothing upscales. Use <InlineCode>?w=48;96</InlineCode> for a fixed-size
						thumbnail. Cannot be combined with <InlineCode>?maxWidth</InlineCode>.
					</PanelRow>
					<PanelRow label="?avifQuality">
						AVIF quality as an integer from 1 to 100. Defaults to 55. Raise it for screenshots,
						diagrams, or fine text with <InlineCode>?avifQuality=70&responsive</InlineCode>. Higher
						values produce larger files.
					</PanelRow>
				</PanelList>
				<Prose>
					Quality is format-specific, so the parameter is named for AVIF and leaves room for a
					future WebP or JPEG setting. There is no <InlineCode>?minWidth</InlineCode>; use{' '}
					<InlineCode>?w</InlineCode> for small fixed sizes.
				</Prose>
				<Prose>
					Only <InlineCode>?maxWidth</InlineCode>, <InlineCode>?w</InlineCode>, and{' '}
					<InlineCode>?avifQuality</InlineCode> are accepted before the final{' '}
					<InlineCode>?responsive</InlineCode> marker. Other imagetools directives, including{' '}
					<InlineCode>?quality</InlineCode> and <InlineCode>?format</InlineCode>, fail the build.{' '}
					<InlineCode>?w</InlineCode> and <InlineCode>?maxWidth</InlineCode> are mutually exclusive;
					use one or the other.
				</Prose>
				<CodeBlock code={overrides} label="Width and quality overrides" language="tsx" />
			</PanelSection>

			<PanelSection id="static-image-component" title="The StaticImage component">
				<Prose>
					The import carries the generated URLs and intrinsic dimensions;{' '}
					<InlineCode>StaticImage</InlineCode> renders them on an <InlineCode>img</InlineCode> and
					sets the intrinsic <InlineCode>width</InlineCode> and <InlineCode>height</InlineCode> so
					the browser reserves space before the file loads. Three props are required:
				</Prose>
				<PanelList>
					<PanelRow label="image">
						The <InlineCode>?responsive</InlineCode> import. It carries <InlineCode>src</InlineCode>
						, <InlineCode>w</InlineCode>, <InlineCode>h</InlineCode>,{' '}
						<InlineCode>placeholder</InlineCode>, and <InlineCode>srcset</InlineCode> (omitted when
						there is one variant).
					</PanelRow>
					<PanelRow label="alt">
						Accessible description. Use an empty string for a decorative image.
					</PanelRow>
					<PanelRow label="sizes">The width the image fills. Required; see below.</PanelRow>
					<PanelRow label="...img props">
						Everything else passes to the underlying <InlineCode>img</InlineCode>:{' '}
						<InlineCode>className</InlineCode>, <InlineCode>style</InlineCode>,{' '}
						<InlineCode>loading</InlineCode>, <InlineCode>fetchPriority</InlineCode>, and so on.{' '}
						<InlineCode>src</InlineCode>, <InlineCode>srcSet</InlineCode>,{' '}
						<InlineCode>width</InlineCode>, and <InlineCode>height</InlineCode> are generated.
					</PanelRow>
				</PanelList>
				<Prose>
					Defaults are <InlineCode>loading="lazy"</InlineCode> and{' '}
					<InlineCode>decoding="async"</InlineCode>. For a hero or LCP image, pass{' '}
					<InlineCode>loading="eager"</InlineCode> and <InlineCode>fetchPriority="high"</InlineCode>
					.
				</Prose>
				<Prose>
					<InlineCode>sizes</InlineCode> is how wide the image appears, not how wide the file is.
					The import produces one URL per width; the browser uses <InlineCode>sizes</InlineCode> and
					the screen’s pixel ratio to choose. A value that is too wide downloads a larger file than
					needed.
				</Prose>
				<CodeBlock code={sizes} label="Common sizes values" language="tsx" />
			</PanelSection>

			<PanelSection id="static-image-placeholder" title="Placeholder">
				<Prose>
					Every import carries a <InlineCode>placeholder</InlineCode>: a CSS background value
					sampled at build time from the source’s top and bottom rows. Close rows become one flat
					color; different rows become a vertical two-stop gradient. It is tens of bytes, makes no
					request, and paints with the reserved box.
				</Prose>
				<Prose>
					Images with alpha and sources whose smallest variant is under 200 px get no placeholder; a
					swatch behind a transparent logo or a thumbnail is not worth the bytes.{' '}
					<InlineCode>StaticImage</InlineCode> applies it as <InlineCode>background</InlineCode>, so
					a <InlineCode>style</InlineCode> prop overrides it:{' '}
					<InlineCode>{"style={{background: 'none'}}"}</InlineCode> removes it.
				</Prose>
			</PanelSection>

			<PanelSection id="static-image-delivery" title="Dev and production">
				<Prose>
					Dev generates the full variant set when an image module first loads, then serves the
					variants from the dev server. The first page that imports several large images waits for
					all their encodes at once; a production build writes every variant to{' '}
					<InlineCode>dist/client/assets</InlineCode> as a hashed file, and the Worker serves it
					directly.
				</Prose>
				<figure>
					<figcaption className="text-sm font-medium text-muted-foreground">Delivery</figcaption>
					<div className="mt-2 rounded-xl border bg-muted/20 p-4">
						<DocDiagram
							source={deliveryPipelineChart}
							label="Static image delivery"
							idPrefix="static-image-delivery"
						/>
					</div>
				</figure>
				<Prose>
					Server builds work as long as sharp can run on the build machine; CI needs a compatible
					native binary. The Worker never processes images.
				</Prose>
			</PanelSection>

			<PanelReferences links={references} />
		</>
	)
}

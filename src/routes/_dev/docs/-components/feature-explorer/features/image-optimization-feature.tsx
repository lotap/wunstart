import {CodeBlock, PromptBlock} from '../../code-block.tsx'
import {PanelLink} from '../../doc-links.tsx'
import {InlineCode, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'
import {FeatureShell} from '../feature-blocks.tsx'

const usage = `import {StaticImage} from '#/components/global/static-image.tsx'
import hero from './-images/hero.jpg?responsive'

<StaticImage
  image={hero}
  alt="A short description"
  sizes="(width < 64rem) 100vw, 50vw"
/>`

const publicUsage = `// public/logo.png
<img src="/logo.png" alt="Logo" />`

const sizes = `sizes="100vw"                        // full-bleed
sizes="(width < 64rem) 100vw, 72rem"  // max-w-6xl content
sizes="(width < 64rem) 100vw, 50vw"   // half-width
sizes="8rem"                          // fixed thumbnail`

const qualityPrompt =
	'Raise the default AVIF quality from 55 to 65. Update the code constant, the docs, and the build diagram label so they agree. Compare one representative image’s output size before and after.'

const webpPrompt =
	'Add a WebP fallback to ?responsive images. Emit a WebP variant for every generated width, add ?webpQuality (1–100, default 80), and render <picture> with AVIF first, WebP second, and WebP as the <img> fallback. Keep sizes on every source.'

const blurPrompt =
	'Add a blur placeholder to ?responsive images. Generate a 24px-wide build-time placeholder under 1 KB, inline it on the import, and show it until the image loads without layout shift.'

const sizePrompt =
	"Add a production image size report. Print each emitted AVIF variant's source, width, and size, plus a total per source. Fail when a variant exceeds 400 KB or total image output exceeds 4 MB."

/** Catalog entry for the static image pipeline. Details live in the reference panel. */
export function ImageOptimizationFeature() {
	return (
		<FeatureShell title="Image optimization" summary="Keep images small and sharp on every screen.">
			<PanelSection id="image-adding" title="Add an image">
				<Prose>
					Put private images in an <InlineCode>-images</InlineCode> folder near the page or
					component that uses them. Shared images go in <InlineCode>src/assets/images</InlineCode>.
				</Prose>
				<CodeBlock code={usage} label="Responsive image usage" language="tsx" />
				<Prose>
					<InlineCode>?responsive</InlineCode> must be the last query parameter. Without it, Vite
					treats the file as an ordinary asset: no variants, no AVIF.{' '}
					<InlineCode>StaticImage</InlineCode> takes the import, <InlineCode>alt</InlineCode> text,
					and <InlineCode>sizes</InlineCode>. Use an empty <InlineCode>alt</InlineCode> for a
					decorative image.
				</Prose>
				<Prose>
					<InlineCode>public/</InlineCode> is not part of the image pipeline. Vite does not process
					those files, so <InlineCode>?responsive</InlineCode> has no effect. Reference them at the
					root URL instead, and keep <InlineCode>public/</InlineCode> for stable-URL or unprocessed
					files:
				</Prose>
				<CodeBlock code={publicUsage} label="Public asset" language="tsx" />
			</PanelSection>

			<PanelSection id="image-widths" title="Widths and quality">
				<Prose>
					The build writes one AVIF file per width. JPEG, PNG, and WebP can all be sources; animated
					GIFs are flattened to a still frame.
				</Prose>
				<PanelList>
					<PanelRow label="default">
						Seven widths: 400, 640, 960, 1280, 1536, 1920, and 2560 px. Rungs above the source width
						are dropped, so the default ladder does not upscale. Start with a source at least as
						wide as the largest variant you need.
					</PanelRow>
					<PanelRow label="?maxWidth">
						Caps the ladder at that width and adds it as a variant when the source is wider. Use{' '}
						<InlineCode>?maxWidth=3840&responsive</InlineCode> for a 4K hero or{' '}
						<InlineCode>?maxWidth=960&responsive</InlineCode> for a card that never renders wider.
					</PanelRow>
					<PanelRow label="?w">
						Replaces the ladder with the exact widths you name. Use{' '}
						<InlineCode>?w=48;96&responsive</InlineCode> for a fixed-size thumbnail.
					</PanelRow>
					<PanelRow label="?avifQuality">
						AVIF quality from 1 to 100; default 55. Raise it for screenshots or fine text with{' '}
						<InlineCode>?avifQuality=70&responsive</InlineCode>; higher values produce larger files.
					</PanelRow>
				</PanelList>
			</PanelSection>

			<PanelSection id="image-sizing" title="Sizing and loading">
				<Prose>
					<InlineCode>sizes</InlineCode> is how wide the image appears, not how wide the file is.
					The import produces one URL per width; the browser uses <InlineCode>sizes</InlineCode> and
					the screen’s pixel ratio to pick the smallest file that covers the slot.
				</Prose>
				<CodeBlock code={sizes} label="Common sizes values" language="tsx" />
				<Prose>
					Images load lazily by default. For a hero or LCP image, pass{' '}
					<InlineCode>loading="eager"</InlineCode> and <InlineCode>fetchPriority="high"</InlineCode>
					.
				</Prose>
			</PanelSection>

			<div className="mt-8 border-t pt-5">
				<p className="text-sm font-medium">Full reference</p>
				<p className="mt-1 text-sm text-muted-foreground">
					See the <PanelLink panel="static-images">Static images reference</PanelLink> for the full{' '}
					<InlineCode>StaticImage</InlineCode> component and pipeline.
				</p>
			</div>

			<PanelSection id="image-extend" title="Extension prompts" className="border-t pt-6">
				<PromptBlock title="Raise the default AVIF quality" prompt={qualityPrompt} />
				<PromptBlock title="Add a WebP fallback" prompt={webpPrompt} />
				<PromptBlock title="Add a blur placeholder" prompt={blurPrompt} />
				<PromptBlock title="Add an image size report" prompt={sizePrompt} />
			</PanelSection>
		</FeatureShell>
	)
}

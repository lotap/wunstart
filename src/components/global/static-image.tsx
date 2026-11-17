import type {StaticImageData} from '#/lib/static-images.ts'

type StaticImageProps = Omit<
	React.ComponentProps<'img'>,
	'alt' | 'height' | 'sizes' | 'src' | 'srcSet' | 'width'
> & {
	image: StaticImageData
	alt: string
	sizes: string
}

/**
 * Renders a build-time AVIF variant set. The image carries its own intrinsic
 * dimensions, so the browser reserves the box before the file loads, and a
 * build-time placeholder paints that box until the file arrives.
 */
export function StaticImage({
	image,
	alt,
	sizes,
	loading = 'lazy',
	decoding = 'async',
	style,
	...props
}: StaticImageProps) {
	if (!image.src) {
		throw new Error(
			'StaticImage needs an image imported with ?responsive. Files in public/ are served as plain URLs; move the image beside the component and import it with ?responsive.',
		)
	}

	return (
		<img
			src={image.src}
			srcSet={image.srcset}
			width={image.w}
			height={image.h}
			alt={alt}
			sizes={sizes}
			loading={loading}
			decoding={decoding}
			style={{background: image.placeholder, ...style}}
			{...props}
		/>
	)
}

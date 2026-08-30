import {pixelBasedPreset, type TailwindConfig} from 'react-email'

/**
 * Hex color scale (Tailwind v3's sRGB values)
 *
 * `tailwindcss/colors` can't be used here: its v4 palette is oklch-based, which
 * react-email's CSS inliner can't process and email clients don't support anyway
 */
const neutral = {
	50: '#fafafa',
	100: '#f5f5f5',
	200: '#e5e5e5',
	300: '#d4d4d4',
	400: '#a3a3a3',
	500: '#737373',
	600: '#525252',
	700: '#404040',
	800: '#262626',
	900: '#171717',
	950: '#0a0a0a',
}

const red = {
	600: '#dc2626',
}

export const emailTailwindConfig = {
	presets: [pixelBasedPreset],
	theme: {
		extend: {
			colors: {
				background: '#ffffff',
				foreground: neutral[950],
				card: {
					DEFAULT: '#ffffff',
					foreground: neutral[950],
				},
				popover: {
					DEFAULT: '#ffffff',
					foreground: neutral[950],
				},
				primary: {
					DEFAULT: neutral[900],
					foreground: neutral[50],
				},
				secondary: {
					DEFAULT: neutral[100],
					foreground: neutral[900],
				},
				muted: {
					DEFAULT: neutral[100],
					foreground: neutral[500],
				},
				accent: {
					DEFAULT: neutral[100],
					foreground: neutral[900],
				},
				destructive: {
					DEFAULT: red[600],
					foreground: neutral[50],
				},
				border: neutral[200],
				input: neutral[200],
				ring: neutral[400],
			},
			fontFamily: {
				sans: ['Inter', 'Arial', 'Helvetica', 'sans-serif'],
				heading: ['Inter', 'Arial', 'Helvetica', 'sans-serif'],
			},
			borderRadius: {
				'sm': '0.375rem',
				'md': '0.5rem',
				'lg': '0.625rem',
				'xl': '0.875rem',
				'2xl': '1.125rem',
				'3xl': '1.375rem',
				'4xl': '1.625rem',
			},
		},
	},
} satisfies TailwindConfig

import {pixelBasedPreset, type TailwindConfig} from 'react-email'
import colors from 'tailwindcss/colors'

export const emailTailwindConfig = {
	presets: [pixelBasedPreset],
	theme: {
		extend: {
			colors: {
				background: colors.white,
				foreground: colors.neutral[950],
				card: {
					DEFAULT: colors.white,
					foreground: colors.neutral[950],
				},
				popover: {
					DEFAULT: colors.white,
					foreground: colors.neutral[950],
				},
				primary: {
					DEFAULT: colors.neutral[900],
					foreground: colors.neutral[50],
				},
				secondary: {
					DEFAULT: colors.neutral[100],
					foreground: colors.neutral[900],
				},
				muted: {
					DEFAULT: colors.neutral[100],
					foreground: colors.neutral[500],
				},
				accent: {
					DEFAULT: colors.neutral[100],
					foreground: colors.neutral[900],
				},
				destructive: {
					DEFAULT: colors.red[600],
					foreground: colors.neutral[50],
				},
				border: colors.neutral[200],
				input: colors.neutral[200],
				ring: colors.neutral[400],
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

import {pixelBasedPreset, type TailwindConfig} from 'react-email'
import colors from 'tailwindcss/colors'

export const emailTailwindConfig = {
	presets: [pixelBasedPreset],
	theme: {
		extend: {
			colors: {
				background: colors.white,
				foreground: colors.stone[950],
				card: {
					DEFAULT: colors.white,
					foreground: colors.stone[950],
				},
				popover: {
					DEFAULT: colors.white,
					foreground: colors.stone[950],
				},
				primary: {
					DEFAULT: colors.orange[700],
					foreground: colors.orange[50],
				},
				secondary: {
					DEFAULT: colors.stone[100],
					foreground: colors.stone[900],
				},
				muted: {
					DEFAULT: colors.stone[100],
					foreground: colors.stone[500],
				},
				accent: {
					DEFAULT: colors.stone[100],
					foreground: colors.stone[900],
				},
				destructive: {
					DEFAULT: colors.red[600],
					foreground: colors.stone[50],
				},
				border: colors.stone[200],
				input: colors.stone[200],
				ring: colors.stone[400],
			},
			fontFamily: {
				sans: ['Public Sans', 'Verdana', 'Arial', 'sans-serif'],
				heading: ['Lora', 'Georgia', 'Times New Roman', 'serif'],
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

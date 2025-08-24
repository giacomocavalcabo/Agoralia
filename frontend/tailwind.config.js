/** @type {import('tailwindcss').Config} */
export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				primary: {
					50:  '#EEF5FF',
					100: '#D9E8FF',
					200: '#B6D2FF',
					300: '#8EB9FF',
					400: '#5F98FF',
					500: '#2E6BFF',   // DEFAULT
					600: '#1F5BFF',
					700: '#1B4ED6',
					800: '#173FA8',
					900: '#112E7A'
				},
				brand: {
					600: 'var(--brand-600)',
					700: 'var(--brand-700)',
				},
				ink: {
					50: 'var(--ink-50)',
					100: 'var(--ink-100)',
					200: 'var(--ink-200)',
					300: 'var(--ink-300)',
					400: 'var(--ink-400)',
					500: 'var(--ink-500)',
					600: 'var(--ink-600)',
					700: 'var(--ink-700)',
					900: 'var(--ink-900)',
				},
				bg: {
					app: 'var(--bg-app)',
					card: 'var(--bg-card)',
					'app-dark': 'var(--bg-app-dark)',
					'card-dark': 'var(--bg-card-dark)',
				},
				line: 'var(--line)',
				'line-dark': 'var(--line-dark)',
				success: 'var(--success)',
				warn: 'var(--warn)',
				danger: 'var(--danger)',
				info: 'var(--info)',
			},
			borderRadius: {
				'radius': 'var(--radius)',
				'radius-lg': 'var(--radius-lg)',
				'radius-xl': 'var(--radius-xl)',
			},
			boxShadow: {
				'soft': 'var(--shadow-soft)',
				'medium': 'var(--shadow-medium)',
				'large': 'var(--shadow-large)',
			},
		},
	},
	plugins: [],
}



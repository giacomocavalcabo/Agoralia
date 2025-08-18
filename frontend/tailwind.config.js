/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html','./src/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			colors: {
				brand: { 400:'var(--brand-400)', 500:'var(--brand-500)', 600:'var(--brand-600)' },
				ink: { 900:'var(--ink-900)', 600:'var(--ink-600)' },
				line:'var(--line)',
				bg: { app:'var(--bg-app)', card:'var(--bg-card)' },
				success:'var(--success)', info:'var(--info)', warn:'var(--warn)', danger:'var(--danger)'
			},
			borderRadius: { xl:'var(--radius)' },
			boxShadow: { soft:'var(--shadow)' }
		}
	},
	plugins: [],
}



const stored = JSON.parse(localStorage.getItem('theme'))
window.document.documentElement.classList.add(
	['light', 'dark'].includes(stored)
		? stored
		: window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light',
)

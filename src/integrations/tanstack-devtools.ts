export function openTanStackDevtools() {
	const trigger = document.querySelector<HTMLButtonElement>(
		'button[aria-label="Open TanStack Devtools"]',
	)

	trigger?.click()
}

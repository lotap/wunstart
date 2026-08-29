export function Footer() {
	const year = new Date().getFullYear()

	return (
		<footer className="flex flex-row justify-center">
			<small>© {year} Wunstart</small>
		</footer>
	)
}

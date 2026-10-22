import {appInfo} from '#/app-info.ts'

/** Calendar year, computed once at module load rather than on every render. */
const year = new Date().getFullYear()

export function Footer() {
	return (
		<footer className="flex flex-row justify-center">
			<small suppressHydrationWarning>
				© {year} {appInfo.name}
			</small>
		</footer>
	)
}

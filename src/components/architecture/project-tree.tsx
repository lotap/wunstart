import {cn} from 'cn'
import {useEffect, useRef} from 'react'

type ProjectNode = {
	name: string
	path: string
	folder?: boolean
	children?: Array<ProjectNode>
}

const projectTree: Array<ProjectNode> = [
	{
		name: 'src',
		path: 'src',
		children: [
			{
				name: 'components',
				path: 'src/components',
				children: [{name: 'ui', path: 'src/components/ui', folder: true}],
			},
			{
				name: 'db',
				path: 'src/db',
				children: [
					{name: 'helpers', path: 'src/db/helpers', folder: true},
					{name: 'migrations', path: 'src/db/migrations', folder: true},
					{name: 'models', path: 'src/db/models', folder: true},
					{name: 'ops', path: 'src/db/ops', folder: true},
					{name: 'index.ts', path: 'src/db/index.ts'},
				],
			},
			{
				name: 'durable-objects',
				path: 'src/durable-objects',
				children: [
					{name: 'argon2-do-hasher.wasm', path: 'src/durable-objects/argon2-do-hasher.wasm'},
					{name: 'auth-hasher.ts', path: 'src/durable-objects/auth-hasher.ts'},
				],
			},
			{name: 'isomorphic', path: 'src/isomorphic', folder: true},
			{
				name: 'middleware',
				path: 'src/middleware',
				children: [{name: '_run-op.server.ts', path: 'src/middleware/_run-op.server.ts'}],
			},
			{name: 'routes', path: 'src/routes', folder: true},
			{name: 'server-fns', path: 'src/server-fns', folder: true},
			{name: 'start.ts', path: 'src/start.ts'},
			{name: 'styles.css', path: 'src/styles.css'},
		],
	},
	{
		name: 'tools',
		path: 'tools',
		children: [
			{
				name: 'linters',
				path: 'tools/linters',
				children: [
					{name: 'anti-slop', path: 'tools/linters/anti-slop', folder: true},
					{name: 'wunshot', path: 'tools/linters/wunshot', folder: true},
					{name: 'wunstart', path: 'tools/linters/wunstart', folder: true},
				],
			},
		],
	},
	{name: 'compose.yaml', path: 'compose.yaml'},
	{name: 'drizzle.config.ts', path: 'drizzle.config.ts'},
	{name: 'doctor.config.json', path: 'doctor.config.json'},
	{name: 'oxlint.config.ts', path: 'oxlint.config.ts'},
	{name: 'wrangler.jsonc', path: 'wrangler.jsonc'},
]

type ProjectRow = {
	name: string
	path: string
	prefix: string
	folder: boolean
}

function flattenProjectTree(
	nodes: Array<ProjectNode>,
	depth = 0,
	ancestorLast: Array<boolean> = [],
): Array<ProjectRow> {
	return nodes.flatMap((node, index) => {
		const isLast = index === nodes.length - 1
		const indent = ancestorLast.map((last) => (last ? '    ' : '│   ')).join('')
		const branch = depth === 0 ? '' : isLast ? '└── ' : '├── '

		const row = {
			name: node.name,
			path: node.path,
			prefix: `${indent}${branch}`,
			folder: node.children !== undefined || node.folder === true,
		}

		if (!node.children) return [row]

		return [row, ...flattenProjectTree(node.children, depth + 1, [...ancestorLast, isLast])]
	})
}

const projectRows = flattenProjectTree(projectTree)

type ProjectTreeProps = {
	areas: Array<string>
}

export function ProjectTree({areas}: ProjectTreeProps) {
	const scrollRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const tree = scrollRef.current

		if (!tree) return

		const treeElement = tree

		function scrollToActive() {
			const firstArea = areas[0]

			if (!firstArea) {
				treeElement.scrollTop = 0

				return
			}

			treeElement.scrollTop = 0

			const highlightedRows = Array.from(
				treeElement.querySelectorAll<HTMLElement>('[data-highlighted="true"]'),
			)

			const firstRow = highlightedRows[0]
			const lastRow = highlightedRows[highlightedRows.length - 1]

			if (!firstRow || !lastRow) return

			const rowHeight = firstRow.offsetHeight
			const firstTop = firstRow.offsetTop
			const lastBottom = lastRow.offsetTop + lastRow.offsetHeight
			const spanHeight = lastBottom - firstTop
			const maxScroll = treeElement.scrollHeight - treeElement.clientHeight

			if (spanHeight <= treeElement.clientHeight) {
				if (lastBottom > treeElement.clientHeight) {
					const available = treeElement.clientHeight - spanHeight
					const contextRows = Math.max(0, Math.floor(available / 2 / rowHeight))
					const target = firstTop - contextRows * rowHeight

					treeElement.scrollTop = Math.max(0, Math.min(target, maxScroll))
				}

				return
			}

			if (firstTop + firstRow.offsetHeight > treeElement.clientHeight) {
				treeElement.scrollTop = Math.min(
					maxScroll,
					firstTop + firstRow.offsetHeight - treeElement.clientHeight + rowHeight,
				)
			}
		}

		const frame = requestAnimationFrame(scrollToActive)

		window.addEventListener('resize', scrollToActive)

		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener('resize', scrollToActive)
		}
	}, [areas])

	return (
		<section
			aria-label="Project structure"
			className="flex min-w-0 flex-col border-t p-4 md:order-1 md:border-t-0 md:p-5"
		>
			<div
				ref={scrollRef}
				className="relative min-h-96 flex-1 scrollbar-thin [scrollbar-color:var(--border)_transparent] overflow-y-auto pr-2 md:min-h-116"
			>
				{projectRows.map((row) => {
					const isActive = areas.some(
						(area) => row.path === area || row.path.startsWith(`${area}/`),
					)

					const isAncestor = !isActive && areas.some((area) => area.startsWith(`${row.path}/`))

					let rowTone = row.folder ? 'text-foreground/70' : 'text-muted-foreground'

					if (isAncestor) rowTone = 'text-foreground/80'

					if (isActive) {
						rowTone = 'bg-foreground/10 text-foreground shadow-[inset_2px_0_0_currentColor]'
					}

					return (
						<div
							key={row.path}
							aria-current={isActive ? 'true' : undefined}
							data-highlighted={isActive || undefined}
							title={row.path}
							className={cn(
								'flex h-5 w-full items-center pr-3 pl-2 font-mono text-xs leading-5 whitespace-pre',
								rowTone,
							)}
						>
							<span aria-hidden="true" className="text-muted-foreground/40">
								{row.prefix}
							</span>
							<span>
								{row.name}
								{row.folder ? '/' : ''}
							</span>
						</div>
					)
				})}
			</div>
		</section>
	)
}

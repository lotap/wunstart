import {environmentGroups} from '../../-content/configuration.tsx'
import {PanelTableHeader} from '../doc-ui.tsx'

/** Add break opportunities after underscores so long names wrap in the table. */
function EnvironmentVariableName({name}: {name: string}) {
	const segments = name.split('_')

	return (
		<code className="font-mono text-xs text-foreground">
			{segments.map((segment, index) => (
				// oxlint-disable-next-line react/no-array-index-key react-doctor/no-array-index-as-key -- segments are positional
				<span key={index}>
					{segment}
					{index < segments.length - 1 && (
						<>
							_<wbr />
						</>
					)}
				</span>
			))}
		</code>
	)
}

export function EnvironmentTable() {
	return (
		<div className="overflow-hidden rounded-xl border bg-muted/20">
			<table className="w-full table-fixed text-left">
				<caption className="sr-only">Environment variables</caption>
				<thead>
					<tr className="bg-muted/30">
						<PanelTableHeader scope="col" className="w-[40%] px-5 py-3">
							Variable
						</PanelTableHeader>
						<PanelTableHeader scope="col" className="px-5 py-3">
							Used for
						</PanelTableHeader>
					</tr>
				</thead>
				{environmentGroups.map((group) => (
					<tbody key={group.name}>
						<tr className="border-t bg-muted/20">
							<PanelTableHeader colSpan={2} scope="colgroup" className="px-5 py-2">
								{group.name}
							</PanelTableHeader>
						</tr>
						{group.variables.map((envVar) => (
							<tr key={envVar.name} className="border-t align-top">
								<th scope="row" className="px-5 py-3 text-left font-normal">
									<EnvironmentVariableName name={envVar.name} />
								</th>
								<td className="px-5 py-3 text-sm leading-relaxed text-muted-foreground">
									{envVar.description}
								</td>
							</tr>
						))}
					</tbody>
				))}
			</table>
		</div>
	)
}

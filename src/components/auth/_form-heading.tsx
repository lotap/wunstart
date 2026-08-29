export function FormHeading({
	headline,
	subhead,
}: {
	headline: React.ReactNode
	subhead: React.ReactNode
}) {
	return (
		<div className="mb-10 text-center">
			<h2 className="mb-3 font-heading text-4xl font-bold text-primary">{headline}</h2>
			<p className="font-heading text-xl font-medium">{subhead}</p>
		</div>
	)
}

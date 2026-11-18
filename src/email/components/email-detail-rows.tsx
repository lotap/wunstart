import {Column, Row, Section, Text} from 'react-email'

import {cn} from '#/lib/utils.ts'

import {formatLocation} from '../format-location.ts'
import {formatEmailTime} from '../format-time.ts'

export type EmailDetailContext = {
	ipAddress: string
	country: string
	city: string | null
	region: string | null
	timezone: string | null
	device: string | null
}

type Detail = {
	label: string
	value: string
}

/** Time, IP, location, and device, grouped into one bordered panel. */
export function EmailDetailRows({
	occurredAt,
	ipAddress,
	country,
	city,
	region,
	timezone,
	device,
}: {occurredAt: Date} & EmailDetailContext) {
	const location = formatLocation({city, region, country})

	const details: Detail[] = [
		{label: 'Time', value: formatEmailTime(occurredAt, timezone)},
		{label: 'IP address', value: ipAddress},
		...(location ? [{label: 'Location', value: location}] : []),
		...(device ? [{label: 'Device', value: device}] : []),
	]

	return (
		<Section className="mb-6 rounded-lg border border-border bg-secondary px-4 py-1">
			{details.map((detail, index) => (
				<Row key={detail.label}>
					<Column className={cn('py-3', index > 0 && 'border-t border-border')}>
						<Text className="m-0 text-sm leading-5 font-medium text-muted-foreground">
							{detail.label}
						</Text>
						<Text className="m-0 mt-1 text-sm leading-5 text-foreground">{detail.value}</Text>
					</Column>
				</Row>
			))}
		</Section>
	)
}

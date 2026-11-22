// Formatters for visitor timezones, built once per zone and shape.
//
// Constructing an `Intl.DateTimeFormat` loads locale data, so validation and
// date formatting for the same zone share one instance. Only valid zones reach
// the caches: an invalid zone throws during construction.

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()
const zoneNameFormatters = new Map<string, Intl.DateTimeFormat>()

/** Long date and short time, e.g. “September 3, 2025 at 2:14 PM”. */
export function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
	const cached = dateTimeFormatters.get(timeZone)

	if (cached) return cached

	const formatter = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'long',
		timeStyle: 'short',
		timeZone,
	})

	dateTimeFormatters.set(timeZone, formatter)

	return formatter
}

/** Short zone abbreviation, e.g. `EST`; the date/time styles cannot carry it. */
export function zoneNameFormatter(timeZone: string): Intl.DateTimeFormat {
	const cached = zoneNameFormatters.get(timeZone)

	if (cached) return cached

	const formatter = new Intl.DateTimeFormat('en-US', {timeZone, timeZoneName: 'short'})

	zoneNameFormatters.set(timeZone, formatter)

	return formatter
}

/** Whether `Intl` recognizes the zone; formatting catches engines that defer validation. */
export function isValidTimeZone(timeZone: string): boolean {
	try {
		dateTimeFormatter(timeZone).format(new Date())

		return true
	} catch {
		return false
	}
}

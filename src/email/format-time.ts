import {dateTimeFormatter, isValidTimeZone, zoneNameFormatter} from '#/lib/timezone.ts'

/** Fallback when the visitor timezone is unknown or invalid. */
const EMAIL_FALLBACK_TIMEZONE = 'America/New_York'

/** Resolve a candidate IANA timezone to a usable value. */
const resolveEmailTimezone = (timezone: string | null | undefined): string => {
	if (!timezone) return EMAIL_FALLBACK_TIMEZONE

	return isValidTimeZone(timezone) ? timezone : EMAIL_FALLBACK_TIMEZONE
}

/**
 * Formats a date for security emails in the visitor’s timezone.
 * Appends the short zone abbreviation (EST/EDT/PST…) so the suffix stays correct.
 */
export const formatEmailTime = (date: Date, timezone: string | null | undefined): string => {
	const resolved = resolveEmailTimezone(timezone)

	const dateTime = dateTimeFormatter(resolved).format(date)

	const abbreviation = zoneNameFormatter(resolved)
		.formatToParts(date)
		.find((part) => part.type === 'timeZoneName')?.value

	return abbreviation ? `${dateTime} ${abbreviation}` : dateTime
}

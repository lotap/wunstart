/** Fallback when the visitor timezone is unknown or invalid. Preserves prior behavior */
export const EMAIL_FALLBACK_TIMEZONE = 'America/New_York'

/**
 * Resolves a candidate IANA timezone to a usable value.
 * Returns the fallback when absent or not recognized by `Intl`.
 */
export const resolveEmailTimezone = (timezone: string | null | undefined): string => {
	if (!timezone) return EMAIL_FALLBACK_TIMEZONE

	try {
		new Intl.DateTimeFormat('en-US', {timeZone: timezone}).format(new Date())
		return timezone
	} catch {
		return EMAIL_FALLBACK_TIMEZONE
	}
}

/**
 * Formats a date for security emails in the visitor's timezone.
 * Appends the short zone abbreviation (EST/EDT/PST…) so the suffix stays correct.
 * (`dateStyle`/`timeStyle` cannot be combined with `timeZoneName`, hence the two formatters.)
 */
export const formatEmailTime = (date: Date, timezone: string | null | undefined): string => {
	const resolved = resolveEmailTimezone(timezone)
	const dateTime = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'long',
		timeStyle: 'short',
		timeZone: resolved,
	}).format(date)
	const abbreviation = new Intl.DateTimeFormat('en-US', {
		timeZone: resolved,
		timeZoneName: 'short',
	})
		.formatToParts(date)
		.find((part) => part.type === 'timeZoneName')?.value

	return abbreviation ? `${dateTime} ${abbreviation}` : dateTime
}

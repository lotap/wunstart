type LocationParts = {
	city: string | null
	region: string | null
	country: string
}

/**
 * Formats the captured geolocation as a display string (e.g. "San Francisco, CA, US")
 * Returns null when nothing meaningful is known: no city/region and country is `XX`
 * (Cloudflare's "unknown client country" sentinel, also the no-data fallback)
 */
export const formatLocation = ({city, region, country}: LocationParts) => {
	const knownCountry = country === 'XX' ? null : country
	const parts = [city, region, knownCountry].filter((part) => part !== null)

	return parts.length ? parts.join(', ') : null
}

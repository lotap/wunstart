/**
 * Network prefix length per IP family.
 *
 * The single definition for every key that must agree: the in-memory rate
 * limiter, an activity's `ip_network`, and a ban's `ip_network`. IPv6 keys the
 * `/64`, so a client rotating addresses inside its own allocation cannot reset
 * its bucket. IPv4 keys the exact address: a `/24` would catch unrelated
 * neighbours behind the same provider or office egress, trading a real false
 * positive for a rotation an attacker with a block can do regardless.
 */
export const IP_NETWORK_PREFIX = {v4: 32, v6: 64} as const

const IPV4_TAIL = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

const HEXTET = /^[\da-f]{1,4}$/

/** Parse a dotted quad into octets, or null when any octet is out of range */
const parseIpv4 = (dotted: string) => {
	const match = IPV4_TAIL.exec(dotted)

	if (!match) return null

	const octets = match.slice(1).map(Number)

	return octets.every((octet) => octet <= 255) ? octets : null
}

/** Rewrite a dotted IPv4 tail into two hexadecimal hextets, or null if absent */
const expandIpv4Tail = (ipAddress: string) => {
	const separator = ipAddress.lastIndexOf(':'),
		match = IPV4_TAIL.exec(ipAddress.slice(separator + 1))

	if (separator < 0 || !match) return null

	const [a = 0, b = 0, c = 0, d = 0] = match.slice(1).map(Number)

	return `${ipAddress.slice(0, separator + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
}

const parseHextets = (parts: readonly string[]) => {
	const values: number[] = []

	for (const part of parts) {
		if (!HEXTET.test(part)) return null

		values.push(Number.parseInt(part, 16))
	}

	return values
}

/** Expand a colon form to exactly eight hextets, or null when it is malformed */
const toHextets = (ipAddress: string) => {
	const separator = ipAddress.indexOf('::')

	if (separator < 0) {
		const parts = ipAddress.split(':')

		return parts.length === 8 ? parseHextets(parts) : null
	}

	/** A second `::` makes the address unparseable */
	if (ipAddress.includes('::', separator + 2)) return null

	const head = ipAddress.slice(0, separator)
	const tail = ipAddress.slice(separator + 2)
	const headParts = head ? head.split(':') : []
	const tailParts = tail ? tail.split(':') : []
	const missing = 8 - headParts.length - tailParts.length

	/** `::` must stand for at least one hextet */
	if (missing < 1) return null

	return parseHextets([...headParts, ...Array.from({length: missing}, () => '0'), ...tailParts])
}

/**
 * True when the address carries an IPv4 address in its low 32 bits:
 * `::ffff:a.b.c.d` (mapped), `::a.b.c.d` (compatible), or `::ffff:0:a.b.c.d`
 * (translated).
 */
const isEmbeddedIpv4 = ([first, second, third, fourth, fifth, sixth]: readonly number[]) =>
	first === 0 &&
	second === 0 &&
	third === 0 &&
	fourth === 0 &&
	((fifth === 0 && (sixth === 0 || sixth === 0xffff)) || (fifth === 0xffff && sixth === 0))

/**
 * `::` (unspecified) and `::1` (loopback) carry zero in the first 96 bits, so
 * the compatible branch would read them as IPv4 holders. Folding `::` would
 * put it on the system-ops sentinel `0.0.0.0`, and neither is a client
 * address, so they take the normal IPv6 path and land in `::/64`.
 */
const isUnspecifiedOrLoopback = (hextets: readonly number[]) =>
	hextets.slice(0, 7).every((value) => value === 0) && (hextets[7] === 0 || hextets[7] === 1)

const formatIpv4 = (hextets: readonly number[]) => {
	const high = hextets[6] ?? 0
	const low = hextets[7] ?? 0

	return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
}

const toIpv6Text = (hextets: readonly number[]) =>
	hextets.map((value) => value.toString(16)).join(':')

/** RFC 5952 text: lowercase, no leading zeros, longest run of zero hextets collapsed */
const formatIpv6 = (hextets: readonly number[]) => {
	let start = -1
	let length = 0

	for (let index = 0; index < hextets.length;) {
		if (hextets[index] !== 0) {
			index++
			continue
		}

		let end = index

		while (end < hextets.length && hextets[end] === 0) end++

		if (end - index > length) {
			start = index
			length = end - index
		}

		index = end
	}

	/** A single zero hextet stays `0`; RFC 5952 only collapses runs of two or more */
	if (length < 2) return toIpv6Text(hextets)

	return `${toIpv6Text(hextets.slice(0, start))}::${toIpv6Text(hextets.slice(start + length))}`
}

/**
 * Canonical CIDR network for an IP address: `/32` for IPv4, `/64` for IPv6.
 *
 * IPv4-mapped, IPv4-compatible, and IPv4-translated IPv6 spellings fold onto
 * the plain IPv4 form before masking, so one client never lands in two
 * buckets. Throws on unparseable input: the ban path only sees values already
 * validated by [IpAddress]{@link (file://./validators.ts)}, and the limiter
 * supplies its own lenient fallback.
 */
export function ipNetwork(ipAddress: string): string {
	const lower = ipAddress.toLowerCase()
	const octets = parseIpv4(lower)

	if (octets) return `${octets.join('.')}/${IP_NETWORK_PREFIX.v4}`

	const expanded = lower.includes('.') ? expandIpv4Tail(lower) : lower
	const hextets = expanded ? toHextets(expanded) : null

	if (!hextets) throw new Error(`ipNetwork: cannot parse IP address "${ipAddress}"`)

	if (isEmbeddedIpv4(hextets) && !isUnspecifiedOrLoopback(hextets))
		return `${formatIpv4(hextets)}/${IP_NETWORK_PREFIX.v4}`

	const hostHextets = IP_NETWORK_PREFIX.v6 / 16
	const masked = hextets.map((value, index) => (index < hostHextets ? value : 0))

	return `${formatIpv6(masked)}/${IP_NETWORK_PREFIX.v6}`
}

/**
 * The address in the form every comparison and key derives from: IPv4-mapped,
 * IPv4-compatible, and IPv4-translated spellings unfold to the plain IPv4
 * address, and everything else comes back lowercased. The HTTP boundary applies
 * this once, so a stored address keeps the same family as the network keyed from
 * it. Throws on unparseable input, like [ipNetwork]{@link ipNetwork}.
 */
export function canonicalIp(ipAddress: string): string {
	const lower = ipAddress.toLowerCase()
	const octets = parseIpv4(lower)

	if (octets) return lower

	const expanded = lower.includes('.') ? expandIpv4Tail(lower) : lower
	const hextets = expanded ? toHextets(expanded) : null

	if (!hextets) throw new Error(`canonicalIp: cannot parse IP address "${ipAddress}"`)

	return isEmbeddedIpv4(hextets) && !isUnspecifiedOrLoopback(hextets) ? formatIpv4(hextets) : lower
}

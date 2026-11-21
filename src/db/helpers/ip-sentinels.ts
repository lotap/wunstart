/**
 * Valid `inet` value that marks a request with no trusted client IP.
 * RFC 5737 TEST-NET-1; reserved for documentation, never a real client.
 * The HTTP boundary rejects it rather than storing it as a request address.
 */
export const INVALID_IP_SENTINEL = '192.0.2.1'

/**
 * Valid `inet` placeholder for system operations that have no client.
 * System ops bypass the HTTP boundary, so the archive cron keeps using it.
 */
export const SYSTEM_OPS_IP = '0.0.0.0'

/** True when the address can be a real client IP rather than one of the sentinels. */
export const isClientIpAddress = (ipAddress: string) =>
	ipAddress !== INVALID_IP_SENTINEL && ipAddress !== SYSTEM_OPS_IP

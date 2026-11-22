/**
 * Valid `inet` placeholder for system operations that have no client.
 * System ops bypass the HTTP boundary, so the archive cron keeps using it.
 */
export const SYSTEM_OPS_IP = '0.0.0.0'

/** True when the address can be a real client IP rather than the system placeholder. */
export const isClientIpAddress = (ipAddress: string) => ipAddress !== SYSTEM_OPS_IP

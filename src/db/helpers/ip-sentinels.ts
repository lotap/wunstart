import {ipNetwork} from './ip-network.ts'

/**
 * Valid `inet` placeholder for system operations that have no client.
 * System ops bypass the HTTP boundary, so the archive cron keeps using it.
 */
export const SYSTEM_OPS_IP = '0.0.0.0'

/** The sentinel as a network, so every spelling of it compares equal */
const SYSTEM_OPS_NETWORK = ipNetwork(SYSTEM_OPS_IP)

/**
 * True when the address can be a real client IP rather than the system
 * placeholder. Compares networks, not strings: an IPv4-mapped spelling of the
 * placeholder folds onto the same `/32`, and unparseable input fails closed.
 */
export const isClientIpAddress = (ipAddress: string) => {
	try {
		return ipNetwork(ipAddress) !== SYSTEM_OPS_NETWORK
	} catch {
		return false
	}
}

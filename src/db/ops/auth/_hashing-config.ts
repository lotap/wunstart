/**
 * Argon2id options based on
 * https://www.rfc-editor.org/rfc/rfc9106.html#name-recommendations
 * cross-reference
 * https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
 * & https://tobtu.com/minimum-password-settings/
 *
 * Kept out of the hashing module so pure callers (rehash checks, parameter
 * audits) read the config without importing the Durable Object layer.
 */
export const HASHING_CONFIG = {
	p: 1, // Parallel
	t: 3, // Time Cost
	m: 2 ** 16, // Memory Cost (64 MiB)
	dkLen: 32, // Hash length
}

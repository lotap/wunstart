import {HASHING_CONFIG} from '#/db/ops/auth/_hashing.ts'

export function needsRehash(hash: string): boolean {
	const match = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(hash)
	if (!match) return true
	const [, version, m, t, p] = match.map(Number)
	if (version === undefined || m === undefined || t === undefined || p === undefined) return true
	return version !== 19 || m < HASHING_CONFIG.m || t < HASHING_CONFIG.t || p < HASHING_CONFIG.p
}

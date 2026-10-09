/** Masks an email for untrusted display, keeping the first char and domain: j***@example.com */
export function maskEmail(email: string): string {
	const [local, domain] = email.split('@')
	if (!local || !domain) return '***'
	return `${local[0]}***@${domain}`
}

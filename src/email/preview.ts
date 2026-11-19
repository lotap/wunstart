/**
 * Values used only by react-email's dev preview. Send-time renders get the
 * public app URL from `EmailService.appUrl` (`APP_URL`) instead.
 *
 * The preview loads the wordmark from the app running on this origin, so keep
 * the app dev server up alongside `dev:email`.
 */
export const emailPreview = {
	appUrl: 'http://localhost:3000',
} as const

type ConversationMessage = {
	role: 'user' | 'agent'
	text: string
}

export type ConversationData = {
	label: string
	messages: ReadonlyArray<ConversationMessage>
}

const profileConversation: ConversationData = {
	label: 'Profile picture',
	messages: [
		{
			role: 'user',
			text: 'Add a feature so users can upload a profile picture.',
		},
		{
			role: 'agent',
			text: 'Done. Avatar column on the user model, a new upload route with R2 storage, and a picker on the settings page. Cropping can wait for a second pass.',
		},
		{
			role: 'user',
			text: 'Let’s do the cropping modal now.',
		},
		{
			role: 'agent',
			text: 'Done. The picker opens a crop modal with a square preview and zoom. The upload route stores the cropped square, so avatars stay consistent everywhere.',
		},
	],
}

const galleryConversations: ReadonlyArray<ConversationData> = [
	{
		label: 'Admin dashboard',
		messages: [
			{
				role: 'user',
				text: 'Build a dashboard that I’ll access from the admin subdomain. I need to log in and see the site analytics there.',
			},
			{
				role: 'agent',
				text: 'Done. Page views land in a page-view model from a small tracking middleware, and an analytics op aggregates them by day. The admin subdomain gets its own host guard, sign-in route, and a dashboard with a 30-day chart and top pages.',
			},
			{
				role: 'user',
				text: 'Make sure regular users can’t reach it, even if they know the URL.',
			},
			{
				role: 'agent',
				text: 'Done. The admin host guard resolves the session and rejects non-admins before the route loads. The analytics op checks the same admin flag server-side, so the data can’t be fetched directly either. Signed-in non-admins get a 404, so the subdomain doesn’t reveal what’s there.',
			},
		],
	},
	{
		label: 'Mailing list',
		messages: [
			{
				role: 'user',
				text: 'Add a mailing list where new sign-ups get a 10% discount.',
			},
			{
				role: 'agent',
				text: 'Done. Subscribers get their own table, and the sign-up op issues a single-use 10% code. The email goes through the existing mail adapter, so Mailpit catches it locally.',
			},
			{
				role: 'user',
				text: 'Make sure that only new users get the 10% code.',
			},
			{
				role: 'agent',
				text: 'Done. The code is issued only on a first sign-up, so existing members never see it. Re-subscribing doesn’t mint another code.',
			},
		],
	},
	{
		label: 'Referral links',
		messages: [
			{
				role: 'user',
				text: 'Add a referral link feature: when somebody uses my referral link, they get a 10% discount, and I also get a hundred credits.',
			},
			{
				role: 'agent',
				text: 'Done. Referral codes live on the user model, and a redeem op writes both rewards in one transaction: 10% off for the friend, 100 credits for you. Credits go to a ledger.',
			},
			{
				role: 'user',
				text: 'Make sure nobody can use their own referral link.',
			},
			{
				role: 'agent',
				text: 'Done. The redeem op rejects self-referrals before it writes either reward, so nobody can farm their own credits.',
			},
		],
	},
]

/** Every gallery slide, in display order. The first one is visible before the gallery activates. */
export const conversations: ReadonlyArray<ConversationData> = [
	profileConversation,
	...galleryConversations,
]

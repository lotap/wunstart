import {cva} from 'class-variance-authority'

import {Bubble, BubbleContent} from '#/components/ui/bubble.tsx'
import {Message, MessageContent} from '#/components/ui/message.tsx'

import type {ConversationData} from '../../-content/conversations.ts'

const conversationVariants = cva(
	'mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 rounded-2xl border p-6 transition-colors duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] sm:p-8 lg:min-h-144',
	{
		variants: {
			bordered: {true: 'border-foreground/10', false: 'border-transparent'},
		},
		defaultVariants: {bordered: false},
	},
)

const bubbleContentVariants = cva('rounded-2xl px-4 py-2.5 text-base leading-relaxed', {
	variants: {
		role: {user: 'rounded-br-sm', agent: 'rounded-bl-sm'},
	},
	defaultVariants: {role: 'agent'},
})

export function Conversation({
	messages,
	revealStartVh,
	revealEndVh,
	bordered,
	galleryTrigger,
}: Pick<ConversationData, 'messages'> & {
	revealStartVh: number
	revealEndVh: number
	bordered: boolean
	galleryTrigger?: boolean
}) {
	return (
		<div className={conversationVariants({bordered})}>
			{messages.map((message, index) => {
				const isUser = message.role === 'user'

				return (
					<Message
						key={message.text}
						align={isUser ? 'end' : 'start'}
						data-reveal="enter"
						data-reveal-start={revealStartVh}
						data-reveal-end={revealEndVh}
						data-gallery-trigger={galleryTrigger && index === messages.length - 1 ? '' : undefined}
					>
						<MessageContent>
							<Bubble
								variant={isUser ? 'default' : 'muted'}
								align={isUser ? 'end' : 'start'}
								className="max-w-[85%]"
							>
								<BubbleContent className={bubbleContentVariants({role: isUser ? 'user' : 'agent'})}>
									<span className="sr-only">{isUser ? 'You said: ' : 'Agent said: '}</span>
									{message.text}
								</BubbleContent>
							</Bubble>
						</MessageContent>
					</Message>
				)
			})}
		</div>
	)
}

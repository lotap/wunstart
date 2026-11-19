import {Schema} from 'effect'
import {ArrowUpRight, X} from 'lucide-react'
import {useState} from 'react'

import {Button} from '#/components/ui/button.tsx'
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockHeader,
	CodeBlockTitle,
} from '#/components/ui/code-block.tsx'
import {FieldDescription, FieldGroup} from '#/components/ui/field.tsx'
import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {Passcode} from '#/isomorphic/validators.ts'

import {ResetEmailVerificationButton} from './_reset-email-verification-button.tsx'
import type {PasscodeRequestQueryOptions} from './_utils.ts'

type PasscodeSubmitCredentials = {passcode: string; email?: string}

/** Dev-only pointer to the local inbox; production sends real email. */
function DevMailpitHint() {
	const [visible, setVisible] = useState(true)

	if (!visible) return null

	const mailpitUrl = import.meta.env.MAILPIT_URL ?? 'http://localhost:8025'

	return (
		<CodeBlock size="sm" className="bg-background/70 text-left">
			<CodeBlockHeader className="border-b pb-2">
				<CodeBlockTitle className="font-mono text-[0.6rem] leading-relaxed tracking-[0.12em] whitespace-normal text-muted-foreground uppercase">
					This panel only appears in the dev environment
				</CodeBlockTitle>
				<CodeBlockActions className="mt-0 self-start">
					<Button
						type="button"
						variant="outline"
						size="icon-xs"
						className="rounded-full"
						aria-label="Dismiss dev-only Mailpit hint"
						onClick={() => setVisible(false)}
					>
						<X aria-hidden="true" />
					</Button>
				</CodeBlockActions>
			</CodeBlockHeader>
			<div className="px-3 py-3">
				<a
					href={mailpitUrl}
					target="_blank"
					rel="noreferrer"
					title="Development only. Production sends a real email and does not render this panel."
					className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground/70 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
				>
					Open Mailpit
					<ArrowUpRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
				</a>
			</div>
		</CodeBlock>
	)
}

export function PasscodeForm({
	onSubmitSchema,
	onSubmitTry,
	email,
	anonBound = false,
	passcodeRequestQueryOptions,
	mutatePasscodeRequest,
	mutatePasscodeRequestIsPending,
}: {
	onSubmitSchema?: Schema.ConstraintCodec<PasscodeSubmitCredentials>
	onSubmitTry: (value: PasscodeSubmitCredentials) => Promise<void>
	email: string
	/** Anon-keyed codes verify only in the browser that requested them */
	anonBound?: boolean
	passcodeRequestQueryOptions: PasscodeRequestQueryOptions
	mutatePasscodeRequest: () => Promise<{expiresAt: Date}>
	mutatePasscodeRequestIsPending: boolean
}) {
	const form = useConfiguredAppForm({
		defaultValues: {email, passcode: ''},
		onSubmitSchema,
		onSubmitTry,
	})

	return (
		<form.AppForm>
			<form
				className="w-full"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					void form.handleSubmit()
				}}
				action="#"
			>
				<FieldGroup>
					{import.meta.env.DEV && <DevMailpitHint />}

					<form.Field
						name="passcode"
						validators={[validateAfterFirstSubmit(Schema.toStandardSchemaV1(Passcode))]}
					>
						{(field) => <field.PasscodeField onComplete={() => form.handleSubmit()} />}
					</form.Field>

					{anonBound && (
						<FieldDescription>
							If you received a code, it works only in the browser where you requested it. On a
							different device, request a new code there.
						</FieldDescription>
					)}

					<ResetEmailVerificationButton
						email={email}
						queryOptions={passcodeRequestQueryOptions}
						mutateAsync={mutatePasscodeRequest}
						mutationIsPending={mutatePasscodeRequestIsPending}
						onRequestNewCode={() => form.resetField('passcode')}
					/>

					<form.OnSubmitErrors />

					<form.SubmitButton label="Next" labelWhileSubmitting="Verifying" />
				</FieldGroup>
			</form>
		</form.AppForm>
	)
}

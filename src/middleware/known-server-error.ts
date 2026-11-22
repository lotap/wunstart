import {createIsomorphicFn} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'
import {Schema} from 'effect'

/** Tagged error for known server errors that should surface to the client */
export class KnownServerError extends Schema.TaggedError<
	KnownServerError,
	{readonly brand: unique symbol}
>()('KnownServerError', {
	message: Schema.String,
	status: Schema.Int,
}) {}

/**
 * Set the status on the server; a no-op on the client, where the throw is a
 * programming error rather than a response.
 *
 * The status must be written before the throw, not only in the request
 * middleware: server-fn middleware catches the error and serializes it as an
 * error result, so the boundary never sees a throw to react to.
 */
const setErrorStatus = createIsomorphicFn()
	.server((status: number) => setResponseStatus(status))
	.client(() => undefined)

/**
 * Set an HTTP error status and throw the matching `KnownServerError`.
 *
 * Boundary only: ops stay transport-agnostic and use `opsFailure`. The status
 * also travels on the error for the boundary and the server-fn serializer.
 * Declared as a function, not a const arrow: TypeScript only narrows after
 * never-returning calls to function declarations.
 */
export function throwKnownServerError(status: number, message: string): never {
	setErrorStatus(status)
	throw new KnownServerError({message, status})
}

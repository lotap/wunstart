/**
 * Cross-module type aliases for the DB layer. A type used by one module stays
 * with that module; row and model types live in `models/`.
 */
import type {EffectPgQueryEffectHKT, EffectPgQueryResultHKT} from 'drizzle-orm/effect-postgres'
import type {BuildRefine} from 'drizzle-orm/effect-schema'
import type {PgTable} from 'drizzle-orm/pg-core'
import type {PgEffectTransaction} from 'drizzle-orm/pg-core/effect'
import type {Constraint} from 'effect/Schema'

import type {DB} from '#/db/index.ts'

/** Type that allows Record shaped schemas including Structs and Unions of Structs */
export type StructLike = Constraint & {readonly Type: object}

export type ArrayOfStructLikes = Constraint & {readonly Type: Array<object>}

/** Drizzle Postgres Effect Transaction object type alias for convenience */
export type Tx = PgEffectTransaction<EffectPgQueryEffectHKT, EffectPgQueryResultHKT>

/** Reference for running a query with the normal db object or a transaction object */
export type QueryExecutor = DB['Service'] | Tx

/** Refinements used for drizzle-orm/effect-schema's create*Schema functions */
export type RefinementsFor<T extends PgTable> = BuildRefine<T['_']['columns']>

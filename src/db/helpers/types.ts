import type {EffectPgQueryEffectHKT, EffectPgQueryResultHKT} from 'drizzle-orm/effect-postgres'
import type {BuildRefine} from 'drizzle-orm/effect-schema'
import type {PgTable} from 'drizzle-orm/pg-core'
import type {PgEffectTransaction} from 'drizzle-orm/pg-core/effect'

import {DB} from '#/db/index.ts'

/** Drizzle Postgres Effect Transaction object type alias for convenience */
export type Tx = PgEffectTransaction<EffectPgQueryEffectHKT, EffectPgQueryResultHKT>

/** Reference for running a query with the normal db object or a transaction object */
export type QueryExecutor = DB['Service'] | Tx

/** Refinements used for drizzle-orm/effect-schema's create*Schema functions */
export type RefinementsFor<T extends PgTable> = BuildRefine<T['_']['columns']>

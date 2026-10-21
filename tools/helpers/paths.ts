// Filesystem anchor shared by the setup phase programs. The helper module
// lives two levels below the repo root, so it is the single place that has
// to know the depth (phases import it instead of computing their own).

import {dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Repo root (two levels above tools/helpers). */
export const ROOT = dirname(dirname(HERE))

# Upstream provenance

The rules in this directory are vendored from
[dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) (MIT — see
`LICENSE` in this directory), a ruleset that is explicitly meant to be
vendored: copied into the implementing repository, then maintained and
adapted there. That is the arrangement here — these files are ours to
change.

- Vendored into this repo 2026-08-28 (`72c81da` “init settings + tools”)
  from upstream main at `6d538555cb15` (2026-08-18, “feat: add opt-in
  Effect lint rules”) — assumed same-day HEAD. Corroborated, not proven:
  exact file-list match (all 34 vendored files present upstream) and a
  logic-identical spot check (`no-service-constructor-imports` differs
  only in repo formatting: single quotes, no semicolons). If a future
  three-way merge conflicts on the base, this assumption was wrong —
  record the corrected base here.
- The update flow (upstream's `install-anti-slop` skill) stages incoming
  source separately, preserves local customizations, and records the
  revision — use it for any future sync, which makes this note the last
  unversioned one.
- Local additions on top of upstream (if any) live alongside the vendored
  rules with no marker; before porting an upstream update, diff rule by
  rule.

## 2026-10-22 update to upstream `13909c9` (2026-10-14, “Merge #45

group-singleline-bindings”)

- Base: `6d538555cb15` (2026-08-18) — confirmed recoverable; base→local
  was formatting-only (tabs, single quotes, no semicolons, no bracket
  spacing per `.oxfmtrc.json`), so the three-way merge applied all
  incoming logic and re-ran `fmt`.
- Incoming: upstream HEAD `13909c9e07590f5a85d93c62712259fe14a883f7`,
  verified two ways — vendored skill bundle
  (`.agents/skills/install-anti-slop/assets/anti-slop`, refreshed in
  `c2906c6`) is byte-identical to upstream
  `skills/install-anti-slop/assets/anti-slop` at HEAD, and a full
  `https://github.com/dmmulroy/anti-slop` clone at HEAD supplied `src/`
  (canonical, includes tests the skill assets omit).
- Adopted: all upstream `src/` changes base→HEAD — 3 new generic rules
  (`no-array-filter-map`, `no-reduce-accumulator-copy`,
  `require-readable-spacing` + `vendor/eslint-stylistic`), 4 new Effect
  rules (`no-manual-effect-error-tag`, `no-manual-tag-comparison`,
  `no-manual-tagged-construction`, `prefer-effect-match` +
  `effect/shared/tagged-values.ts`), new shared helpers
  (`array-method`, `function-parameters`, `scope`,
  `type-alias-resolution`), rewritten semantics (`no-known-value-widening`,
  `no-object-parameters`, `no-unknown-returns`, `no-unknown-parameters`,
  `no-unknown-type-aliases`, `no-unsafe-dictionary-type`,
  `require-safety-comment-for-type-assertion`, `no-module-mocking`,
  `no-runtime-typeof`, `no-shape-in-symbol-names`, `dictionary-types`,
  `reflect-method`), and all new/updated upstream tests.
- Intentional local deviations:
  - Repo formatting throughout (`fmt` after copy).
  - `rules/no-runtime-typeof.ts`: bracket access
    (`option['allowInTypeGuards']`) for
    `noPropertyAccessFromIndexSignature`.
  - `shared/dictionary-types.ts`: `unsafeMembers[0] ?? null` for
    `noUncheckedIndexedAccess`. Upstream passes `tsc` with looser
    settings; both fixes are behavior-preserving for the `tsgo` gate.
  - `rules/require-readable-spacing-cli.test.ts`: wrapped in
    `vitest` `test()` and spawns `bunx oxlint` instead of `pnpm exec
    oxlint` so `bun run test:lint` runs it (upstream runs it via `tsx`
    under pnpm).
- Config (`oxlint.config.ts`, user-approved “all new rules”): enabled at
  `error` the 3 new generic rules plus native companion
  `oxc/no-accumulating-spread`, and all 5 Effect rules (including the
  previously registered but never enabled
  `no-service-constructor-imports`). No dependency changes: local
  `oxlint`/`@oxlint/plugins` `^1.89.0` already exceeds upstream `1.78.0`.
- Verification: `test:lint` 26 files / 508 tests pass (incl. adapted CLI
  autofix-stability test); `tsgo --noEmit` clean; `oxlint --fix` + `fmt`
  cleared all 1058 `require-readable-spacing` findings with a stable
  second pass. Remaining `lint` findings left for owners (no semantic
  rewrites done here): `anti-slop-effect/no-manual-tag-comparison` in
  `src/db/ops/ops-error.ts:140`, `anti-slop-effect/prefer-effect-match`
  in `src/db/ops/auth/_user-agent.ts:25` and
  `tools/helpers/project-files.ts:326`; pre-existing and untouched:
  `react(purity)` in `src/components/footer.tsx:4` and 3×
  `typescript(no-generated-empty-object-type)` warnings.
- Backup of the pre-update tree: `.tmp/anti-slop-backup/` (plus staging
  at the `mktemp` dir recorded in `.tmp/anti-slop-stage-path.txt` and
  upstream clone at `.tmp/anti-slop-upstream/`).

## 2026-11-15 update: selected open PR fixes

- Base: `13909c9` (2026-10-14) — upstream `main` is still this revision,
  and the skill bundle still matches it. No merged upstream update
  exists after the 2026-10-22 sync.
- Incoming: an integration branch (`.tmp/anti-slop-upstream`,
  `integrate-prs`) built from `main` plus the open PR heads below. These
  are unmerged upstream changes, reviewed here individually rather than
  treated as a release.
  - #46 `7116611` — nested tagged patterns in `Match` calls
  - #49 `179cbe8` — nested functions are outside broad catch handlers
  - #51 `2bef4a2` — opt-in `requireArrayReceiver` for reducers
  - #52 `33108b4` — class-expression scope + broad generic keys
  - #53 `407add1` — spacing statement boundaries + overload groups
  - #55 `2851bfa` — array evidence through static property paths
  - #56 `5b27ece` — lazy `no-widen-then-assert` scope cache
  - #57 `26815ad` — optional chaining in Effect tag reads
  - #58 `1246b1a` — nested generic alias instantiations
  - #61 `68da8e9` — qualified type/JSX member names are borrowed
  - #62 `bc6f002` — alias bodies resolve in their own type parameters
  - #63 `a340b4c` — dictionary alias arguments bind in their own scope
  - #64 `6d50908` — array factories, `split`, `flat`, `sort`, `reverse`
  - #67 `0f75afd` — overload implementation signatures
  - #72 `327f40c` — function types in generic bounds/defaults
  - #73 `d98b54e` — union-typed arguments to type guards
- Not adopted:
  - #59 (`d02a8d6`, formatter-ignore docs): documentation-only; local
    formatting policy is unchanged.
  - #75 (`67904f2`, npm distribution): packaging-only; this repository
    vendors source.
- Conflict resolution: #52 and #63 both touched broad mapped keys; the
  merge keeps #52's generic-alias support but passes #63's resolved
  substitution environment into the alias body. #55 and #64 both extend
  array evidence; the merge keeps static property paths plus factory and
  split recognition. #67 and #72 both extend `no-unknown-returns`; both
  overload and type-parameter-bound suppressions are retained.
- Intentional local deviations preserved:
  - Repo formatting throughout (`oxfmt`).
  - `rules/no-runtime-typeof.ts`: bracket access for
    `noPropertyAccessFromIndexSignature`.
  - `shared/dictionary-types.ts`: `unsafeMembers[0] ?? null` for
    `noUncheckedIndexedAccess`.
  - `rules/require-readable-spacing-cli.test.ts`: wrapped in `vitest`
    `test()` and spawns `bunx oxlint`.
  - Additional strictness fixes from this merge:
    `no-unknown-returns` guards indexed reads and narrows class elements;
    `no-reduce-accumulator-copy` uses bracket access for the new option.
  - `rules/no-widen-then-assert-cli.test.ts`: adapted to `vitest` and
    `bunx oxlint`.
  - The #67 overload cases are part of the existing `RuleTester` suite
    because `tester.run` cannot be called inside a `vitest` test.
- Config: adopted #51's opt-in `requireArrayReceiver` option but did not
  enable it. Existing severities, options, ignores, and plugin paths are
  unchanged.
- Application cleanup from newly detected true positives (authorized as
  part of this update): four adjacent `filter`/`map` chains were replaced
  with loops or `flatMap` in `framework-shelf.tsx`, `email/layer.ts`,
  `activities---bans/queries.ts`, and `probe-postgres.ts`.
- Verification: `test:lint` 27 files / 645 tests pass, including the
  adapted CLI tests; `bun run check` passes; `bun run build` passes.
- Backup of the pre-update tree: `.tmp/anti-slop-backup-2026-11-15/`.
  Staging/integration clone: `.tmp/anti-slop-upstream` branch
  `integrate-prs`.
- Baseline remains `13909c9` plus the selected PRs above. A future
  update must reconcile these unmerged changes again until upstream
  merges or supersedes them.

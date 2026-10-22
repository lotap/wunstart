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

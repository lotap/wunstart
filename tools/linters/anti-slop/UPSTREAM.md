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

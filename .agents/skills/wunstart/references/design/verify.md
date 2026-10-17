# Design verification gate

_Load for page- and section-scale visual work (ladder in `process.md`). Run before declaring that work done._

If the answer to any applicable question is no, revise until all the answers are yes. At section scale, read "page" as the surface you are building. (page) marks whole-page-only questions — skip them below page scale; (marketing) marks marketing surfaces; (chrome) marks header, footer, or nav changes; (data-bound) marks surfaces backed by queries.

- Is there a clear direction or action to take?
- (page, marketing) Is the above-the-fold content striking and actionable, with one idea memorable after a single scan?
- (page) Does each section have one object of focus?
- (page) Can the page be understood by scanning the headlines?
- Does each element earn its inclusion?
- Is there one clear conceptual direction that anchors the design?
- Do the spacings, typefaces, and colors adhere to the established system?
- Does each of the borders, boundaries, and cards used provide genuine value to the user?
- When motion is present, does it enhance hierarchy/atmosphere? Does the page still feel complete if motion is disabled?
- Do interactive elements respond on pointer-down and stay responsive (`motion.md`)?
- (data-bound) Do empty, loading, and error states hold the same standard as the loaded view?
- (chrome) Does it read correctly on every layout it mounts under?
- Does all of the above hold true across screen sizes, devices, and both token modes?

## Run mechanics

- Dev server: see `AGENTS.md` (`bun run dev`, kill by PID only).
- Critique from screenshots — required for page- and section-scale work (save under `<worktree>/.tmp/`, see `AGENTS.md`).
- Both token modes: chrome-devtools `emulate` `colorScheme` `dark`, then `light`. Mobile: emulate a phone viewport. Reduced motion: emulate `prefersReducedMotion`.
- Interactive states: hover, pressed, disabled read correctly in both token modes; keyboard pass keeps focus visible (tab through every interactive element).
- Data-bound UI: exercise default, empty, loading, and error states (`AsyncBoundary`/`ErrorBoundary`, skeleton) in every layout and identity mode the surface ships in.
- Chrome changes: sample every layout under both identity modes.
- Performance (page scale): `lighthouse_audit` via chrome-devtools, or the vendored `web-perf` skill for a deeper audit.
- Typecheck + lint: `bunx tsgo --noEmit` and `bun --bun run lint:check`.

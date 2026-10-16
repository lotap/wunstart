# Design: adapting input, replacing the look

This file is the hard contract every visual decision must satisfy. Taste beyond it: the craft refs (`design-copy.md`, `design-visual.md`, `design-motion.md`) or an installed design skill — see Precedence below.

Precedence when sources conflict: 1. direct instructions · 2. this contract · 3. an installed design skill's direction · 4. craft defaults (`design-copy.md`, `design-visual.md`, `design-motion.md`). An installed skill may override craft taste only — never this contract, `design-process.md`, or the `design-verify.md` gate.

## Adapting outside input

Outside proposals (skill, mockups, screenshots) bend to these constraints, never the reverse:

- Theme-aware in both modes: `theme` (`light`/`dark`/`system`, default) vs `resolved` for paint decisions; SSR renders light, then hydrates (`contexts/theme.tsx`). New UI must read correctly under both tokens, never assume one mode.
- Tokens over arbitrary values: palette lives in `src/styles.css` (`:root` + `.dark`, stock shadcn oklch). New colors enter as tokens, not one-off hex in classNames. Semantic colors carry their meaning (`destructive` means danger) — don't recruit new hues for decoration and dilute the signal, whatever the direction.
- Existing primitives first: fields, drawers, toasts, `AsyncBoundary`/`ErrorBoundary`, `RouterButton`/`Link` (see `references/app.md`). Don't invent parallel components for solved problems; the `ui/**` override patterns (caller `cn()`, `render` prop, narrow patch exception) live in `references/app.md`.
- CVA cuts both ways: generated primitives take variant props (`<Button variant="destructive" size="sm">`), extended via `className` through `cn()` — never by editing the variant maps; bespoke components define their own maps colocated in-file (`pinButtonVariants({isPinned})`), so state→class mapping lives in CVA, not ternaries.
- Data only through the established patterns: reads via `queryOptions` + `useSuspenseQuery`, drafts via the localStorage query hook (see `references/app.md`) — no ad-hoc fetching in components, whatever the direction proposes.
- Copy voice: sentence case (headings and copy), curly quotes and apostrophes, `…` not `...`, acronyms spelled out on first use, no decorative emoji; user-facing errors form-level.

Quality floor for every change, however small: keyboard focus visible; `prefers-reduced-motion` respected; both token modes read correctly (modes detail above); mobile hierarchy holds (craft in `design-visual.md`).

## Replacing the default look

The stock shadcn theme is a transparent scaffold, not a house style — replace it freely. What must keep working:

- Keep both token blocks (`:root` + `.dark`) in `src/styles.css` coherent; the provider resolves `system` via `prefers-color-scheme` and persists the choice in localStorage. Dropping dark mode is allowed but must be deliberate (remove the variant + toggle, don't leave a dead switch).
- Email templates carry a hex duplicate of the tokens (the inliner can't do oklch) — update both or mail drifts from app (see `references/email.md`).
- Fonts arrive via fontsource imports at the top of `src/styles.css` (Inter variable, Fraunces, Space Mono today); swap by changing the imports, not by adding a font-loading mechanism.
- Stock shadcn theming works untouched — paste a new theme over the token blocks and move on. No custom CSS labyrinth to unwind, by design.

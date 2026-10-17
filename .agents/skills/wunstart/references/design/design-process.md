# Page-craft process

_Load when creating or reshaping UI — route by scope first._

## Route the work first

- Page — a new route, or an existing page reshaped end to end. Full process below, full gate (`design-verify.md`).
- Section or component — card, footer, drawer, empty state. `design.md` contract, the relevant craft refs, and the gate minus the (page) questions (`design-verify.md`).
- Cosmetic or token tweak — copy or color swap, spacing nudge. Contract and quality floor (`design.md`), typecheck and lint. No gate.

Rungs are cumulative: every rung honors the contract, the quality floor, and the facts rule; section adds the §1 context pass and the §2 concept checkpoint; page adds whole-page composition and the (page)-marked gate questions.

Classify the surface alongside the rung: marketing page, app surface, or chrome. Marketing claims poster composition and marketing voice; app surfaces answer to task clarity first; chrome is judged on every route under both identity modes (signed-out anon vs signed-in user), never in isolation.

Worked examples: pricing page → page rung, marketing surface, `_auth-anon` or `_auth-dynamic` when the call adapts by auth, prices are load-bearing facts. Status card → section rung, app surface, source its query via the `queryOptions` pattern (`references/app.md`). Footer restyle → section rung on chrome, site-wide consequences. Token tweak → cosmetic rung.

With no design skill installed, the craft refs are the built-in taste — a floor, not a neutral scaffold. Precedence: `design.md`.

Never present invented specifics as real. Route unknowns before building:

- Load-bearing facts — prices, plan names, statuses, claims. Ask the user once, batched, before styling.
- Incidental unknowns — omit.
- Deferred anyway? Placeholder content is fine when it reads as placeholder: skeleton, lorem ipsum, visibly-labeled stub. Never a de facto value — a plausible-looking price or stat standing in for an unknown one is fabrication. Links resolve to real routes only.

You are capable of extraordinary creative work. Do not squander your freedom for ordinary results. Do not hold back. Show what can be achieved by committing to thoughtful, deliberate, opinionated aesthetic choices.

## 1. Conceptualize and contextualize

Identify the subject matter and audience before any visual choice.

Read the repo before assuming its shape. `src/routes/**` is the sitemap — the tree and each layout's comment describe what exists and what guards it. Read one or two existing pages closest to the work (`references/app.md` lists exemplars). `CONTEXT.md` is the domain glossary — translate the task's wording against it before that wording enters copy, code names, or file names (account → User, guest → Anon).

Decide extend or replace explicitly. A stock theme is a scaffold; replace it freely (`design.md`). Once a house language exists, new work must read as the same site as its closest sibling; harvest existing motifs before inventing a parallel look.

Inspect the codebase, your conversation history, and any other given materials to establish:

- What is this page about?
- Who is it for? Who is reading or using it?
- What are they trying to do?
- How does the page solve their need or answer their question?

Build in the user's best interest. Provide solutions and avoid dark patterns.

Explicitly decide what _not_ to build. Do not fracture the user's trust or attention with unnecessary or half-baked features.

## 2. Plan

Content dictates design, not the other way around. Plan the content first, then route by concern: copy → `design-copy.md`; layout, type, color, depth → `design-visual.md`; motion and interaction → `design-motion.md`.

When no direction is given, or the given direction leaves decisions open, derive one from the subject's own world before styling — its materials, audience, and purpose — never fall back to a stock look.

State the concept in one or two sentences in chat before building. Test it: a concept that would fit any similarly-shaped page equally well is a default, not a choice — rewrite it.

## 3. Compose code

### Review the plan

Designs are disposable. Do not get overly attached to one idea. If something isn't working, start over and move on.

### Build

Start a dev server and critique the work as you build. Take screenshots and assess as you go — required at page and section scale (`design-verify.md` has the mechanics).

Aggressively explore prototypes to evaluate options and alternatives.

Scrutinize any bugs or breakages from the core conceptual design direction or other guidelines. Fix them in order of highest impact until none remain.

Plans stay internal — no plan documents. Scratch work goes in `.tmp/` only (`bun run clean:tmp` wipes it). Commands live in `design-verify.md`.

## 4. Revise and refine

Judge the page as a whole. If it's too busy, reduce content. If it's too loud, reduce competing elements. If it's too safe, amplify focal relationships. When it's too thin, reinforce hierarchy.

Arbitrary design decisions, sloppy details, bugs, and poor performance break trust with the reader. The end result must feel deliberately crafted. Excellence relies on execution.

Before declaring the work done, run the gate at your rung: `design-verify.md`.

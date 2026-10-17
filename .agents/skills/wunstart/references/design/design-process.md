# Page-craft process

_Load when creating or reshaping UI — route by scope first._

## Route the work first

- Page — a new route, or an existing page reshaped end to end. Full process below, full gate (`design-verify.md`).
- Section or component — card, footer, drawer, empty state. `design.md` contract, the relevant craft refs, and the gate minus the (page) questions (`design-verify.md`).
- Cosmetic or token tweak — color swap, spacing nudge (copy changes load `design-copy.md` at any rung). Contract and quality floor (`design.md`), typecheck and lint. No gate.

Rungs are cumulative: every rung honors the contract, the quality floor, and the facts rule; section adds the §1 context pass and the §2 concept checkpoint; page adds whole-page composition (§3/§4) and the (page)-marked gate questions.

Classify the surface alongside the rung: marketing page, app surface, or chrome. Marketing claims poster composition and marketing voice; app surfaces answer to task clarity first; chrome is judged on every route under both identity modes (signed-out anon vs signed-in user), never in isolation.

Worked examples: pricing page → page rung, marketing surface, `_auth-anon` or `_auth-dynamic` when the call adapts by auth, prices are load-bearing facts. Status card → section rung, app surface, source its query via the `queryOptions` pattern (`references/app.md`). Footer restyle → section rung on chrome, site-wide consequences. Token tweak → cosmetic rung.

With no design skill installed, the craft refs are the built-in taste — a floor, not a starting look. Precedence for any conflict: `design.md` over the craft refs, per its Precedence list.

Never present invented specifics as real. Route unknowns before building:

- Load-bearing facts — prices, plan names, statuses, claims. Ask the user once, batched, before styling. Incidental unknowns — omit, don't ask.
- Placeholder content is fine when it reads as placeholder: skeleton, lorem ipsum, visibly-labeled stub. Never a de facto value — a plausible-looking price or stat standing in for an unknown one is fabrication. Links resolve to real routes only.

## 1. Conceptualize and contextualize

Read the repo before assuming its shape. `src/routes/**` is the sitemap — the tree and each layout's comment describe what exists and what guards it. Read one or two existing pages closest to the work (`references/app.md` lists exemplars). `CONTEXT.md` is the domain glossary — translate the task's wording against it before that wording enters copy, code names, or file names (account → User, guest → Anon).

Decide extend or replace explicitly (`design.md`). Once a house language exists, new work must read as the same site as its closest sibling; harvest existing motifs before inventing a parallel look. Be bold within the contract and tokens — originality lives in concept and composition, not in breaking the system.

Inspect the conversation history and given materials to establish:

- Who is it for — who is reading or using it?
- What are they trying to do, and how does the page answer it?

Avoid dark patterns.

Explicitly decide what _not_ to build — cut unnecessary or half-baked features.

## 2. Plan

Content dictates design, not the other way around. Plan the content first, then route by concern: copy → `design-copy.md`; layout, type, color, depth → `design-visual.md`; motion and interaction → `design-motion.md`.

When no direction is given, or the given direction leaves decisions open, derive one from the subject's own world before styling — its materials, audience, and purpose — never fall back to a stock look.

State the concept in one or two sentences in chat before building. Test it: a concept that would fit any similarly-shaped page equally well is a default, not a choice — rewrite it.

## 3. Compose code

### Abandon and restart

If exploration stalls or the concept fails its own test, discard the draft and restart rather than over-repairing it.

### Build

Start a dev server and critique and fix the work as you build, highest impact first. Take screenshots and assess as you go — mechanics in `design-verify.md`.

Explore prototypes to compare options against the concept: solo, iterate in place; genuinely open page-scale directions, run the `SKILL.md` compare flow (one agent per run) instead of stacking variants here.

Plans stay internal — no plan documents. Scratch: see `AGENTS.md` (`.tmp/`); commands: see `design-verify.md`.

## 4. Revise and refine

Judge the page as a whole. If it's too busy, reduce content. If it's too loud, reduce competing elements. If it's too safe, amplify focal relationships. When it's too thin, add one focal contrast.

Before declaring the work done, run the gate at your rung: `design-verify.md`.

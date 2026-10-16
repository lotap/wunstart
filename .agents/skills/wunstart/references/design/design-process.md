# Page-craft process

_Load when creating or reshaping a page or substantial UI._

With no design skill installed, the craft refs are the built-in taste — a floor, not a neutral scaffold. Precedence: `design.md`.

Never fabricate or invent facts, figures, or promises. Omit what is unknown and move on.

You are capable of extraordinary creative work. Do not squander your freedom for ordinary results. Do not hold back. Show what can be achieved by committing to thoughtful, deliberate, opinionated aesthetic choices.

## 1. Conceptualize and contextualize

Identify the subject matter and audience before any visual choice.

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

If any part of the plan feels like a generic default and not a purposeful choice, rewrite that part.

## 3. Compose code

### Review the plan

Designs are disposable. Do not get overly attached to one idea. If something isn't working, start over and move on.

### Build

Start a dev server and critique the work as you build. If possible, take screenshots and assess as you go.

Aggressively explore prototypes to evaluate options and alternatives.

Scrutinize any bugs or breakages from the core conceptual design direction or other guidelines. Fix them in order of highest impact until none remain.

Plans stay internal — no plan documents. Scratch work goes in `.tmp/` only (`bun run clean:tmp` wipes it). Commands live in `design-verify.md`.

## 4. Revise and refine

Judge the page as a whole. If it's too busy, reduce content. If it's too loud, reduce competing elements. If it's too safe, amplify focal relationships. When it's too thin, reinforce hierarchy.

Arbitrary design decisions, sloppy details, bugs, and poor performance break trust with the reader. The end result must feel deliberately crafted. Excellence relies on execution.

Before declaring the work done, run the gate: `design-verify.md`.

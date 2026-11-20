# Docs page content

The `/docs` page is developer-facing reference, not a changelog or an implementation tour. Write for a reader who is trying to do something.

## First-pass checklist

For every feature or reference section, answer these before writing:

1. What is the reader trying to do?
2. Where does the file, configuration, or definition go, and does placement change behavior?
3. What inputs, limits, prerequisites, or data-handling rules apply?
4. What is the minimal working example (code, config, or request)?
5. How does it work end to end?
6. What changes in dev vs production, or local vs CI?
7. What are the common failure modes, and how do they show up? What happens if the reader combines the feature with the adjacent wrong path?
8. What is the public surface — the props, options, endpoints, events, or permissions the reader will touch? Include required inputs, defaults, generated values, pass-through, and explicitly unsupported options.
9. What can the reader do next, and which reference covers the depth?

Not every question applies to every section. Skip the ones the reader does not need; do not invent answers.

## Feature tab

A feature tab is a task, not a shortened reference. It must let the reader complete the basic task without opening the reference. Repeat the reference detail the task needs; the reference owns depth, edge cases, rejected options, and internals.

When a feature has real depth, write the reference panel alongside the tab. The tab carries the first task and links to the reference; the reference owns the internal flow tours, routes, ops, models, and failure matrix. Do not turn the tab into an implementation tour.

- Open with the basic task. If placement changes behavior, make placement the first decision and show each path with its own minimal example.
- Lead each section with one sentence stating the core behavior. Put defaults, ranges, and caveats in the option’s own row, not the intro.
- Answer the likely wrong combination directly. Say what happens (“not processed,” “no effect”) instead of describing only the correct path.
- Prefer concrete paths, URLs, and outputs over abstract terms. If a term needs unpacking, replace it with the example.
- Show the supported path. Name only the unsupported option the basic task could hit; leave the full contract to the reference.
- End with a separate next-step block: a subhead or divider, one plain sentence about what the reference adds, then the link. Do not bury it in the last content section.

## Rules

- Start from the reader’s task, not the implementation. If a line does not help them do the task or make a decision, cut it.
- Introduce a concept before relying on it. Link related concepts explicitly: name the input, the transform, and the consumer.
- Explain a directive or option with what it does, why it exists, when to use it, its syntax, and its unsupported neighbors.
- Document the full public surface: required inputs, defaults, generated values, pass-through, and explicitly unsupported options. Keep each default with the option it controls.
- State trust boundaries: who can call it, what is allowed by default, and what is stored or audited.
- Plain English. Short paragraphs. One idea per block.
- Use sections, tables, code, and diagrams. Never leave a section as a wall of prose.
- Keep each panel’s prose, examples, diagrams, and data with the panel component — in the panel file or a private child beside it. Do not create a shared docs content module. The explorer may list panels for navigation; the list must not hold their content.
- One diagram per concept. Split a diagram that exceeds roughly six nodes or needs horizontal scrolling, and place each piece next to the explanation it supports.
- Verify behavior before documenting a limitation. Say what actually happens (“it is flattened to a still frame”), not an absolute the code does not enforce.
- Prefer the durable rule over the current snapshot: state the invariant and why, and link to the source of truth instead of restating a list of files, ops, env keys, or consumers. Name a path only when it is the interface the reader must use.
- Do not ship a control or disclosure with nothing behind it.
- A feature summary states the capability or payoff, not the how-to.
- Use examples as proof or a concrete use case, not project-internal trivia.
- Cut architecture bragging, cache paths, internal names, and duplicated facts unless they change a decision.

## Extend prompts

- Title the section “Extension prompts”; the feature tab already names the feature.
- Start with the first prompt. Do not open with a sentence that restates what the prompt blocks are (“each prompt is a complete task,” “pick the one closest”).
- Each prompt is a concrete modification task: the goal and the non-obvious design choices. Name the concrete values that matter, such as a quality, budget, or breakpoint.
- State the target or decision in the prompt. Do not make the implementing agent ask a question that could have been answered up front.
- Skip generic non-regression instructions (“keep existing imports working”), gate commands (“run `bun run check`”), acceptance criteria that merely restate the task, and process instructions (“show every file you touch”). Those are default agent behavior.
- Offer multiple prompts when the feature has distinct extension paths. Change different layers—defaults or configuration, output, loading, build tooling—not several variations of the same change.

## Anti-patterns

- A required input, option, or concept appears only inside an example.
- Two related concepts are explained in separate sections with no link between them.
- A parameter is documented without why or when to use it.
- Unsupported options are left to guesswork instead of being named.
- A default lives away from the option it controls.
- Placement differences are described in prose instead of shown as two paths.
- A feature tab repeats the full contract or every rejected option instead of the basic task.
- The reference link trails the last content section with no separation.
- A limitation says “cannot” without saying what happens instead.
- A control or disclosure opens onto nothing.
- One mega-diagram covers several concepts; split it by concept.
- A feature summary repeats the quick start.
- An extend section opens with a sentence that restates the obvious instead of starting with the first prompt.
- One generic extend prompt stands in for several distinct extension paths.
- An extend prompt asks a question that forces a round trip instead of stating the target.
- An extend prompt spends words on generic non-regression instructions, gate commands, process instructions, or restating its own acceptance criteria.
- A feature tab is only a summary that points at the reference; the reader cannot complete the basic task from it.
- A feature tab opens with an implementation tour (routes, ops, models) instead of the reader’s first task.
- A flow diagram or backend call chain sits in a feature tab when a reference panel owns the internals.
- A docs content module holds prose, diagrams, or panel content instead of letting each panel own it.
- The section explains how the code is organized instead of how the reader uses it.

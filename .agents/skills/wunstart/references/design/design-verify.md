# Design verification gate

_Load when creating or reshaping a page or substantial UI — same boundary as `design-process.md`. Run before declaring that work done._

If the answer to any of these questions is no, revise until all the answers are yes:

- Does the page fulfill the user's needs?
- Is there a clear direction to go or action to take?
- Is the above-the-fold content striking, memorable, and actionable?
- Does each section have one object of focus?
- Can the page be understood by scanning the headlines?
- Does each element earn its inclusion?
- Is there one clear conceptual direction that anchors the design?
- Do the spacings, typefaces, and colors adhere to the established system?
- Do each of the borders, boundaries, and cards used provide genuine value to the user?
- Is motion used to enhance the hierarchy and atmosphere?
- Are the interactive elements smooth and responsive?
- Does all of the above hold true across screen-sizes and devices?

## Run mechanics

- Dev server: `bun run dev` (:3000, never `bun --bun`). Kill by PID only: `lsof -ti :3000 -sTCP:LISTEN | head -1 | xargs kill`.
- Critique from screenshots: chrome-devtools `filePath` resolves from the workspace root — save to `<worktree>/.tmp/<file>`.
- Typecheck + lint: `bunx tsgo --noEmit` and `bun run lint`.
- Confirm both token modes read correctly and take a mobile pass.
- If tokens changed, mirror the hex duplicate into the email templates (`references/email.md`).

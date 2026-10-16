# Default visual direction

_Load when no design direction was given, or the given direction leaves decisions open._

This file is the repo's built-in taste: with no design skill installed, a competent, non-templated page still ships. It is the floor, not the ceiling — an installed design skill overrides its direction. It never overrides the `design.md` contract (tokens, both modes, primitives, data patterns) or direct instructions.

Precedence when sources conflict:

1. Direct instructions
2. `design.md` contract
3. An installed design skill's direction
4. This file's direction

Two layers: the **process** (conceptualize, plan, build, revise) always applies; the **direction** (typefaces, palette, layout concept) yields to #3 when a skill exists. With none installed, follow the direction below rather than freestyling — but it is opinionated by design, not a neutral scaffold.

---

When instructions, requirements, or guidelines are in conflict, prioritize as such:

1. Always follow direct instructions
2. Preserve existing codebase conventions
3. Use the process below to generate distinct and effective pages

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

### Content

Content should dictate design, not the other way around.

Plan for empty states when applicable. A search with no results deserves as much consideration as the results.

#### Hierarchy

Order by reader need. Lead with the strongest solution or most critical information. Do not invent a call-to-action unless warranted.

Each section should have its own focus. Combine duplicates and strip distractions.

#### Copy

What needs to be said? What is the most helpful way to say it?

Do not treat words as decoration. Text should be scannable and convey a message.

Write for the end user. The purpose of the page should set the voice. Marketing pages, dashboards, and documentation have different target audiences.

Talk to the audience authentically without lip-service. Do not manufacture personality.

Tone should reflect the expected state the user will be in. Respect their time and energy.

Do not apologize for errors, but do explain them and if the user can take an action to resolve them.

Avoid decorative labels. If labels are necessary, use specific direct language, not vague titles.

Do not restate or present information the reader already knows.

If removing copy improves the page, keep deleting.

Do not rely on obvious or go-to wording and phrases, they make the whole page feel templated and stale.

##### Use

- Plain speech
- Active voice
- Direct addressing: `you`, not `the user`
- Sentence case in headings
- Descriptive subheadings
- Paragraphs of 2-4 sentences
- Sentences around 20 word target
- Spelling out of acronyms on first instance
- Curly quotes instead of straight
- Ellipsis `…`, not three dots `...`

##### Avoid

- Em dashes, dashes, or colons as punctuation
- Vague, generic, or filler phrases
- Passive voice
- Rhetorical questions
- Weasel words and weak adverbs
- Superficial phrases starting with -ing words
- Dense, complicated, or over-compressed sentences that aren't clear on first pass
- Paragraphs longer than 4 sentences
- Subheadings of single generic words
- Prompt language or design commentary
- Decorative emojis
- Bold for arbitrary emphasis instead of critical information
- Straight quotes instead of curly

### Styling

#### Layout

Design for mobile-first. Mobile views should not break the established hierarchy.

Above-the-fold content must provide a striking headline, image, video, or interactive experience. Style it as a poster, not a document.

Do not save space for non-existent features.

Do not always pick the obvious layout. Evaluate your options and pick the one that is most conducive to the user's objective.

##### Composition

Treat the page as a whole, not an assortment of components. Set a single core conceptual direction.

Pace content purposefully, varying density and emphasis. When everything is bold, nothing stands out.

Each section should have a single focal interest and one primary action or takeaway.

Maintain a consistent visual grid alignment between sections. Use 12 columns unless specified elsewhere.

Align elements to a shared edge, baseline, grid line, or other optical center. Do not leave content stranded or floating.

Only use asymmetry, overlap, and grid-breaking flow with the intent to add visual interest or break monotony.

The layout should provide a clear visual hierarchy and obvious path for the eye to follow, even when the words load asynchronously and rely on skeleton loaders.

Rank all elements in importance. Do not style elements of different importance equally. Use size, font-weight, and color to differentiate.

Do not allow secondary or tertiary actions to add clutter or noise. They can be present, but not prominent.

Build on existing familiar layout patterns and keep consistent. Only change common convention to make a statement.

##### Spacing

Start with swaths of extra space, then reduce until it looks good. Open space should amplify the focal elements.

Sections do not need to be full-bleed. Use the content to guide the max-width.

Group related elements together. Ensure there is more space around the group than within it.

Let parent containers handle internal rhythm. Avoid arbitrary one-off offsets.

Beware compounding emptiness when a gap is next to an underfilled section or orphaned element. Resize or reflow the sections to balance the proportions.

#### Typography

Typographic choices imbue the page with character and can enforce hierarchy.

Include type, especially in headers, as an active part of the design concept, not an arbitrary bystander.

Aim for ~65 characters per line. Allow from 45-80 characters. Do not adjust the font size to achieve that, instead rewrite or reflow the content.

Adapt the line-height to the font-size and paragraph width. Small font gets tall line-height. Large font gets short line-height. Line-height should also scale with the width of the text passage.

Adapt the letter-spacing to the font-size. Headlines get tight tracking. Body copy gets normal or comparatively looser tracking. All-caps lines also get looser tracking.

Left-align any text longer than 3 lines.

When using multiple font sizes in one line, align them along the baseline, not vertical center.

##### Choosing fonts

Use the fonts set by the theme.

If the theme only uses the defaults, you may search for and add new typefaces that elevate the aesthetic and add interest.

You don't need a different font for display, headline, and body. A single typeface can suffice. When you choose to use more than one, make each unique and distinct.

#### Color

Design in monochrome first. Use size, space, typography, and contrast to establish hierarchal order before applying color.

Once the hierarchy has cemented, use splashes of color to distinguish important sections or actions.

Use vibrant, dominant, sharp colors over timid, muted, evenly-distributed palettes.

Status does not always need color. Success does not need to be green. Only add color when highlighting the status adds meaning or value.

#### Images and icons

Do not add stock images, generative illustrations, or fake screenshots.

Do not use icons as decoration. Use them when they make an action more recognizable.

Any images added to the page should enhance the shared thematic visual narrative without adding visual clutter.

To increase contrast between text and a background image, you can:

- add a semi-transparent overlay to the image
- decrease the contrast of the image
- add a text-shadow to the text
- some combination of the above

If an icon needs to increase significantly in size, enclose it in a shape instead of increasing it directly

#### Depth

Pages generally operate on one continuous canvas. Add surface boundaries when a section must convey something spacing and alignment cannot express.

Do not wrap everything in a panel or card. If it can be plain without losing meaning, remove the card styling.

Avoid nested cards.

Perceived depth can enforce hierarchy. Light elements feel closer and raised and draw attention. Dark elements feel further and inset and provide structure.

The size of a shadow an element casts contributes to depth. Use small shadows to make elements feel closer to the page and large shadows to make them feel closer to the user.

Animate shadows on interactivity to imply motion on the z-axis.

When an element is floating above others, try small blur or gradient masks in place of borders.

If an element on top is translucent, scale size of the blur with the size of the element. A larger blur implies a thicker material.

Never stack translucent elements on top of each other.

#### Motion

Design for stillness first. The page should feel complete without motion. It should serve to enhance what already works.

Motion can create presence, inform interactivity, indicate state change, preserve momentum, and strengthen the visual narrative. Do not use it for noise or ornamentation.

A single well-orchestrated sequence creates higher impact than scattered effects. Focus on creating those moments on page-load and for confirming primary actions.

Do not use animation on keyboard shortcuts or known power-user flows.

Elements enter and exit along a consistent path. If it slides in from the right, it dismisses to the right.

Animating in and out use inverse animation timings. If it eases-in on entrance, it should ease-out on exit.

Exit animations should be faster than entrance ones.

Avoid sudden changes in brightness.

Prefer CSS transitions to keyframes when animations could use either.

Large objects should be semi-transparent while in motion.

Use blur to smooth messy transitions.

Animate the blur radius as elements change size.

### Interactivity

#### Provide feedback

Use status confirmations, updates, warnings, and error messages.

Respond during interaction, don't wait until submit. Validate inline. Update values in realtime.

#### Keep the user in control

Use flows that allow the user to undo or eject early.

Remove alerts, dialogs, or other friction wherever possible, add friction to irreversible actions.

Never obstruct a user's ability to interact with an input because of an animation or transition.

#### Eliminate lag and latency

Respond on pointer-down, don't wait until release to show feedback.

Remove non-essential debounces, delays, etc from input paths.

## 3. Compose code

### Review the plan

Designs are disposable. Do not get overly attached to one idea. If something isn't working, start over and move on.

If any part of the plan feels like a generic default and not a purposeful choice, rewrite that part.

### Build

Start a dev server and critique the work as you build. If possible, take screenshots and assess as you go.

Aggressively explore prototypes to evaluate options and alternatives.

Scrutinize any bugs or breakages from the core conceptual design direction or other guidelines. Fix them in order of highest impact until none remain.

## 4. Revise and refine

Judge the page as a whole. If it's too busy, reduce content. If it's too loud, reduce competing elements. If it's too safe, amplify focal relationships. When it's too thin, reinforce hierarchy.

Arbitrary design decisions, sloppy details, bugs, and poor performance break trust with the reader. The end result must feel deliberately crafted. Excellence relies on execution.

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

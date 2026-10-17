# Design visuals

_Load for layout and styling work: composition, spacing, typography, color, media, depth._

### Layout

Design for mobile-first. Mobile views should not break the established hierarchy.

Above-the-fold content must provide a striking headline, image, video, or interactive experience. Style it as a poster, not a document. When no legitimate imagery exists, the headline is the image — set the type as the hero. Purposeful shader or canvas treatments count as crafted media; stock and generative filler do not (see Images and icons).

Do not save space for non-existent features.

Do not always pick the obvious layout. Evaluate your options and pick the one that is most conducive to the user's objective.

#### Composition

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

#### Spacing

Start with swaths of extra space, then reduce until it looks good. Open space should amplify the focal elements.

Sections do not need to be full-bleed. Use the content to guide the max-width.

Group related elements together. Ensure there is more space around the group than within it.

Let parent containers handle internal rhythm. Avoid arbitrary one-off offsets.

Beware compounding emptiness when a gap is next to an underfilled section or orphaned element. Resize or reflow the sections to balance the proportions.

### Typography

Typographic choices imbue the page with character and can enforce hierarchy.

Include type, especially in headers, as an active part of the design concept, not an arbitrary bystander.

Aim for ~65 characters per line. Allow from 45-80 characters. Do not adjust the font size to achieve that, instead rewrite or reflow the content.

Adapt the line-height to the font-size and paragraph width. Small font gets tall line-height. Large font gets short line-height. Line-height should also scale with the width of the text passage.

Adapt the letter-spacing to the font-size. Headlines get tight tracking. Body copy gets normal or comparatively looser tracking. All-caps lines also get looser tracking.

Left-align any text longer than 3 lines.

When using multiple font sizes in one line, align them along the baseline, not vertical center.

#### Choosing fonts

Use the fonts set by the theme.

If the theme only uses the defaults, you may search for and add new typefaces that elevate the aesthetic and add interest.

You don't need a different font for display, headline, and body. A single typeface can suffice. When you choose to use more than one, make each unique and distinct.

### Color

Design in monochrome first. Use size, space, typography, and contrast to establish hierarchal order before applying color.

Once the hierarchy has cemented, use splashes of color to distinguish important sections or actions.

Use vibrant, dominant, sharp colors over timid, muted, evenly-distributed palettes.

Status does not always need color. Success does not need to be green. Only add color when highlighting the status adds meaning or value.

### Images and icons

Do not add stock images, generative illustrations, or fake screenshots.

Do not use icons as decoration. Use them when they make an action more recognizable.

Any images added to the page should enhance the shared thematic visual narrative without adding visual clutter.

To increase contrast between text and a background image, you can:

- add a semi-transparent overlay to the image
- decrease the contrast of the image
- add a text-shadow to the text
- some combination of the above

If an icon needs to increase significantly in size, enclose it in a shape instead of increasing it directly

### Depth

Pages generally operate on one continuous canvas. Add surface boundaries when a section must convey something spacing and alignment cannot express.

Do not wrap everything in a panel or card. If it can be plain without losing meaning, remove the card styling.

Avoid nested cards.

Perceived depth can enforce hierarchy. Light elements feel closer and raised and draw attention. Dark elements feel further and inset and provide structure.

The size of a shadow an element casts contributes to depth. Use small shadows to make elements feel closer to the page and large shadows to make them feel closer to the user.

Animate shadows on interactivity to imply motion on the z-axis.

When an element is floating above others, try small blur or gradient masks in place of borders.

If an element on top is translucent, scale size of the blur with the size of the element. A larger blur implies a thicker material.

Never stack translucent elements on top of each other.

Grounding: tokens live in `src/styles.css` (`:root`/`.dark`); state→class maps live in colocated CVA maps; fonts follow the fontsource mechanism — see `design.md` (override patterns in `references/app.md`).

# Design motion and interactivity

_Load for motion and interaction work._

### Motion

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

Grounding: gate motion behind `motion-reduce:`; feedback patterns (toasts, inline errors, boundaries) route through `references/app.md`.

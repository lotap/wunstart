# Design motion and interactivity

_Load for motion and interaction work._

### Motion

Design for stillness first. The page should feel complete without motion. It should serve to enhance what already works.

Motion can create presence, inform interactivity, indicate state change, preserve momentum, and strengthen the visual narrative. Do not use it for noise or ornamentation.

A single well-orchestrated sequence creates higher impact than scattered effects. Focus on creating those moments on page-load and for confirming primary actions.

Do not use animation on keyboard shortcuts or known power-user flows.

Elements enter and exit along a consistent path.

Entering and exiting use inverse timings: ease-out on entrance, ease-in on exit.

Exit animations should be faster than entrance ones.

Avoid sudden changes in brightness (flashes, opacity jumps, filter swings).

Prefer CSS transitions to keyframes when animations could use either.

### Interactivity

#### Provide feedback

Respond during interaction for non-form feedback and update values in realtime; forms' validation stays silent until first submit with form-level errors (`references/app.md`).

#### Keep the user in control

Use flows that allow the user to undo or eject early.

Keep every flow ejectable and as frictionless as possible; prefer undo/eject over alerts/dialogs; add friction only for irreversible actions, so that friction still signals importance.

Never obstruct a user's ability to interact with an input because of an animation or transition.

#### Eliminate lag and latency

Respond on pointer-down, don't wait until release to show feedback.

Remove non-essential debounces, delays, etc from input paths.

Grounding (when this file is loaded alone): gate motion behind `motion-reduce:`; feedback patterns (toasts, inline errors, boundaries) route through `references/app.md`.

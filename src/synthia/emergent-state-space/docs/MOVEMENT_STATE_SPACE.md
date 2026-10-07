# Movement is state, not decoration

v0.5 removes the old "CSS box slides from A to B" shortcut.

A physical world transition is now represented by explicit deterministic agent states:

`idle -> orient -> locomote* -> arrive/interact`

The renderer chooses a sprite frame from the semantic movement frame (`walk_left`, `walk_profile`, `walk_right`, `run`, `reach`, `sleep`, etc.). The art does not decide behavior.

## Five-field projection

- **Movement** — transition initiation and each locomotion step.
- **Evolution** — a completed transition becomes part of history / changed experience.
- **Being** — the settled embodied state at the destination or a same-location interaction.
- **Design** — selection of route/intent before movement begins.
- **Space** — relation to the target location, confirmed again on arrival.

Every movement event is recorded in the agent history. `EmergentMesh.ingestAgentHistory()` converts those events into sparse `embodiment` nodes and `next-movement-state` runtime edges. These are runtime/personal state nodes, not canonical I Ching gate claims.

## Sprite semantics

All four breeds share the same 16 semantic frames:

1. idle
2. blink
3. happy
4. paws
5. walk_left
6. walk_profile
7. walk_right
8. run
9. jump
10. hover
11. land
12. reach
13. food_hold
14. food_open
15. eat
16. sleep

The original 4x4 sprite sheets are preserved under `app/assets/sprite-sheets/`. Runtime-ready isolated frame PNGs are under `app/assets/sprites/<breed>/`.

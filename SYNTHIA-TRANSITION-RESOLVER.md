# Synthia Transition Resolver v1

The resolver is a thin inverse capability index over the existing canonical identity/address system.

## Runtime law

`Observe → Difference → Match Transition → Trigger Address → Verify`

A transition is:

`T = (S_before, Conditions, Address, S_after)`

Every canonical intake record derives a transition descriptor. If before/after conditions cannot be established, the descriptor remains explicitly `unresolved`; absence is never inferred from missing knowledge.

## Files

- `src/synthia/resolver/ProblemSignature.mjs`
- `src/synthia/resolver/TransitionDescriptor.mjs`
- `src/synthia/resolver/TransitionIndex.mjs`
- `src/synthia/resolver/TransitionResolver.mjs`
- `src/synthia/resolver/OutcomeVerifier.mjs`

## Existing systems reused

- ComponentRegistry / canonical address
- Living Mesh
- Resonance Network
- Self Integration
- ATO-addressable nodes
- Tool Factory
- Morph
- Native Grammar
- existing execution systems

No replacement global controller was introduced.

## Recursive solving

When state B is required:

1. Return immediately if B already exists.
2. Find addressed transitions producing B.
3. Inspect the selected capability's prerequisite states.
4. Recursively resolve each missing prerequisite.
5. Activate the capability through the existing Living Mesh.
6. Verify the resulting state.
7. Retain outcome evidence for later resonance/learning.

The transition index is many-to-many.

# Synthia Address → Five-Substrate → Transition Integration

## Verified pre-patch path

1. `SynthiaRuntime.process()` resolves text through `canonicalState.resolve(text)`.
2. The canonical address is passed into `LivingMeshRuntime.processCue(...)`.
3. Component identities and transition descriptors already carry canonical addresses.
4. `TransitionResolver` indexed those addresses but ranked/planned from state atoms
   (`accepts`, `produces`, `requires`, context, scale, resonance).
5. The resolved cue address did not participate in the transition calculation.

That was the missing seam.

## Patch

The supplied five-substrate kernel is installed unchanged at:

`src/synthia/five-substrate/grammarKernel.mjs`

`AddressSubstrateCalculator` now computes five simultaneous projections for an addressed
transition candidate:

- Movement: candidate state transformation
- Evolution: resolver history/sequence
- Being: current state at the resolved canonical position
- Design: transition requirement validity
- Space: relation between current and candidate canonical addresses

The current canonical address dimension identifies the primary projection, while all five are
retained.

`TransitionResolver` preserves its existing score formula. If an address is supplied:

- Design may mark a candidate unavailable when requirements are not satisfied.
- Canonical address affinity is used only to break otherwise equal scores.
- The full calculation is attached to the plan step and passed into capability activation.

No DEG, Geo-DEG, Native Grammar, Morph, Living Mesh, canonical-address, or transition
implementation was replaced.

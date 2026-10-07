# Gate → Line → Color → Tone → Base → Klein → Transition Trace

## Existing calculations reused

No replacement Klein system was added.

The bridge reuses:

- `ato-core/address-space.mjs`
  - canonical Gate/Line/Color/Tone/Base normalization
  - Gate → six-bit state
- `ato-core/state-space-kernel.mjs`
  - the existing 24-feature state vector
  - the existing GLCTB modulation of that vector
  - existing equivalence transforms between addressed states
- `ato-core/iching.mjs`
  - Gate relation
  - shortest changing-line path
- `ato-core/klein-iching.mjs`
  - Klein eight-house location
  - deterministic house-to-house operator
- the previously integrated five-substrate grammar
- the existing Transition Resolver

## New seam

`KleinAddressCalculator` packages those already-existing calculations into one
deterministic addressed calculation and supplies it to `AddressSubstrateCalculator`.

The five-substrate result now carries:

`Address → GLCTB state/vector → Klein house/operator → five simultaneous substrate
projections → Transition Resolver`

The calculation is observational/routing data. It does not replace the resolver's
existing state-transition authority or invent new Gate meanings.

## Real end-to-end proof

Problem:

`Create an executable tool that inspects gate-address relationships.`

Observed path:

1. Canonical address resolved to Movement / Gate 11 / Line 1 / Color 1 / Tone 1 / Base 1.
2. Existing Gate state: `001010`.
3. Existing Klein eight-house location: House 4, row 3, The Arousing.
4. Candidate capability address produced a two-changing-line Gate route: lines 2 and 4.
5. Five-substrate Movement proposed the `executable` state.
6. Design confirmed the transition prerequisites.
7. Transition Resolver selected `synthia-tool-synthesis-worker`.
8. The real mounted worker synthesized and mounted:
   `BigramMovementG1L4`
9. Outcome verification returned `supported`.

This proves the integrated path can calculate, resolve, act, and verify without
replacing DEG, Geo-DEG, Native Grammar, Morph, Living Mesh, Tool Factory, or the
Transition Resolver.

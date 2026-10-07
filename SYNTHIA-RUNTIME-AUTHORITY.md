# Synthia Runtime / Interoperability Status

This file records which runtime paths are active. The filename is retained for continuity; **it does not mean that one Automaton is in charge of the mesh**.

## Mesh rule

An Automaton is a sovereign node. It owns itself and its internal state. The mesh carries the public relationship/state needed for interaction: address, capabilities, projection membership, packets, outcomes and learned resonance. A node's private internals are not made public merely because it participates.

There is no master Automaton.

## Current front door

`src/pages/welcome/welcome.js`
→ `src/synthia/synthiaRuntime.mjs`

For each current text cue, `SynthiaRuntime` resolves the public canonical state/address and emits the cue into `LivingMeshRuntime`. The Living Mesh can signal mounted nodes that subscribe to cue/outcome events.

The current `GenerativeExperimentOrchestrator` is still invoked explicitly after mesh activation. That execution/search node is **architecturally transitional**; it is not treated as the ruler of Morph, DEG, Geo-DEG, ATO, Klein, the neural nodes, or the StateSpace. Human Design/transit-driven activation is the planned replacement for some explicit sequencing.

## State and mesh

`src/synthia/stateSpace.js` now exposes both:

- `CanonicalStateAuthority` / 13-field address projection from `canonicalState.mjs`
- the restored `StateSpace` / `EmergentStateMesh` from `emergent-state-space/runtime.mjs`

The restored structural StateSpace is the original five-dimensional 5 × 64 = **320-node** space. It is not replaced by the address resolver.

`LivingMeshRuntime` activates the five shared projections recovered from the Kimi lineage:

- Knowledge
- Causal
- Phase
- Temporal
- Dependency

These are projections/relations over participating nodes rather than five duplicated copies of every node.

## Active independent nodes/capabilities

- ATO Core and trace firing
- restored 320-node StateSpace / EmergentMesh
- Morph Engine
- Morph Chat
- Klein/tool population
- DEG grammar learner
- Geo-DEG grammar geometry
- Integrated Tool Factory v1.4.0
- Generative Experiment search/execution node
- Perspective Connection Field
- Human Design GraphSAGE neural node
- Generative Channel Field
- Neural Architecture / capability-modulation node

The current Tool Factory remains the active synthesis implementation. Older factories remain preserved as lineage donors.

## Neural connection layer

### Perspective Connection Field

Browser-native port of the Flask donor's shared 64-node field:

- 64 moving nodes
- 36 weighted connections per node
- 13 filters
- five perspective projections
- AXON → AXIS → ARC-SECOND → BIGRAM → TRIGRAM → HEXAGRAM → DECAGRAM forms

The original donor view labels are retained. The Living Mesh adapter maps them explicitly:

- COGNITIVE → Knowledge
- RELATIONAL → Causal
- SENSORY → Phase
- TEMPORAL → Temporal
- AXIAL → Dependency

This mapping is an integration adapter, not a claim that the donor used Synthia's five names.

### Human Design GNN

The trained Neural-Network-Builder checkpoint is mounted as its own callable node. It uses 64 gate nodes and 36 Human Design channel edges. The browser port reproduces the donor PyTorch checkpoint within the neural verification tolerance.

Its labels were synthetic/rule-supervised. It therefore supplies a verified learned connection function, not an empirical scientific validation of Human Design.

It does not fire on arbitrary text. It needs actual Human Design/transit placement input.

### Generative Channel Field

The Generative-Process-Cluster donor provides bigram → trigram → hexagram → channel → emergent-junction behavior. Its exact 34-entry donor channel list is preserved. The active adapter can separately use the 36-edge graph verified by the trained GNN donor.

### Neural Architecture Generator

The 36 family runtime modulates capability activation/composition. It does not own capabilities. All participating Automatons remain sovereign nodes.

## Compatibility files

- `src/synthia/atoEngine.js` delegates to the current Synthia runtime for legacy imports.
- `src/synthia/stateSpace.js` preserves old import locations while exposing the restored structural StateSpace and canonical address API.

Compatibility filenames must not become a second competing global runtime.

## Restored but not fully active

- Browser Hand: reasoning/compiler systems restored; Android-local browser executor adapter still required.
- Autonomous Agent / GraphRuntime lineage: preserved for selective reconciliation; not promoted as a second global runtime.
- Astral Matrix / Human Design donor: structural chart material restored; precision live ephemeris/transit activation still required.
- SynthAI FULL SUITE r21.22 closure: verified major prior lineage preserved; unique organs still need reconciliation.
- Foundry: semantic compiler donor is executable, but full current app-generation path is not yet wired end-to-end.
- Tribler/IPv8 and modern self-build: planned ecosystem layers, prerequisite-dependent rather than excluded.
- SwarmResearch-style lineage evolution and AutoLabs-style validator/repair: planned higher-order layers.

## Verification

The current explicit Synthia/restoration/donor chain is run with:

`npm run test:synthia-complete`

The separately preserved Kimi lineage is run with:

`npm run test:synthia-kimi-donor`

`npm run test:synthia-everything` runs both.

The full dependency-installed Acode/Vitest suite and physical Android acceptance remain separate build-machine/device checks.

# Synthia Neural / Connection Mesh Integration

## Purpose

This checkpoint reconciles the neural and connection donors with the existing Living Mesh without replacing the working ATO, StateSpace, Morph, DEG/Geo-DEG, Tool Factory or experiment systems.

The integration rule is:

**preserve donor → verify behavior → port only the necessary browser/runtime contract → mount as an independent mesh node.**

No MCP layer was introduced.

## Donor findings

### Flask.zip — shared connection field

`automata_engine.py` contains the connection system that most closely matches the described emergence hierarchy:

- one shared field of 64 nodes
- 36 weighted connections per node
- 13 filters
- five perspective projections
- forms: AXON, AXIS, ARC-SECOND, BIGRAM, TRIGRAM, HEXAGRAM, DECAGRAM
- local propagation and learning

The donor's five labels are AXIAL, RELATIONAL, TEMPORAL, COGNITIVE and SENSORY. They are preserved verbatim in the port. Synthia adds an explicit projection adapter:

| Donor view | Living Mesh projection |
| --- | --- |
| COGNITIVE | Knowledge |
| RELATIONAL | Causal |
| SENSORY | Phase |
| TEMPORAL | Temporal |
| AXIAL | Dependency |

The important donor property is retained: the five dimensions are perspectives on the **same moving nodes**, not five separate 64-node universes.

Runtime: `src/synthia/neural/connectionField.mjs`

### Neural-Network-Builder.zip — trained Human Design GraphSAGE

The donor contains a genuine PyTorch GraphSAGE model and a trained checkpoint.

Graph:

- 64 Human Design gate nodes
- 36 channel edges
- 34 input features per gate plus body-Sun conditioning
- three GraphSAGE message-passing layers
- 64-gate codon head
- awareness heads

The checkpoint was trained on **synthetic/rule-supervised labels**. This integration preserves that limitation explicitly.

The browser-native inference port was checked against an exported PyTorch fixture. Observed maximum numeric difference was approximately `8.3e-8`, below the `1e-6` verification threshold.

Runtime:

- `src/synthia/neural/humanDesignGNN.mjs`
- `src/synthia/neural/humanDesignGNNWeights.mjs`
- `src/synthia/neural/humanDesignGNNFixture.mjs`

This node is mounted and callable, but does not invent planetary/transit placements from chat text. It is waiting for the precision Human Design/transit substrate.

### Generative-Process-Cluster — process/channel emergence

The donor implements:

`bigram → trigram → hexagram → channel → emergent junction`

The exact donor `CHANNEL_PAIRS` list contains 34 entries and is preserved as `PROCESS_CHANNEL_PAIRS`. It is **not relabeled as 36**.

For the active integration, a separate adapter may use the 36-channel graph independently verified by the trained GNN donor. That distinction keeps provenance falsifiable.

Runtime: `src/synthia/neural/generativeChannelField.mjs`

Verified positive outcomes can reinforce relevant gate levels; negative outcomes can reduce them.

### neural-architecture-generator — capability modulation

The donor exposes 36 executable architecture families and composition/modulation functions.

These are lightweight local mathematical family implementations, not full production implementations of every architecture name.

The most important donor contract is preserved:

> the neural layer modulates capability activation; it does not define, remove, or restrict capabilities.

Runtime: `src/synthia/neural/architectureModulation.mjs`

So a neural architecture can affect activation/weighting while the Automaton owning a capability remains sovereign.

### Creating a Modular Semantic AI System.zip

This contains the much broader `SynthAI-FULL-SUITE-r21.22-closure` lineage. Its own `npm run verify` completed successfully during donor audit.

It explicitly contains the graph families:

- Knowledge
- Causal
- Phase
- Temporal
- Dependency

and many older organism/build/state systems.

It is preserved as a major lineage donor. Its `SynthiaUnit`/GraphRuntime is **not promoted wholesale** over the current Living Mesh because that would create a second competing whole-system runtime. Unique organs should be reconciled individually.

## Current live signal wiring

### Cue

`SynthiaRuntime`
→ canonical public state/address
→ `LivingMeshRuntime.processCue()`
→ five semantic projections
→ cue subscribers

The Perspective Connection Field subscribes to cues and updates its own shared connection state.

### Outcome

verified runtime outcome
→ `LivingMeshRuntime.observeOutcome()`
→ public outcome/resonance update
→ outcome subscribers

The Generative Channel Field can update gate/channel activation from outcome quality.

### Callable neural nodes

The Human Design GNN and Neural Architecture Generator are registered/mounted nodes. They are callable by capability. They are not forced to run on every cue.

Private weight matrices and node-internal state are not copied into Living Mesh snapshots.

## ATO / Tool Factory / Foundry boundary

ATO remains the node/firing substrate and trace boundary. The active Integrated Tool Factory remains the verified tool-synthesis implementation and can join synthesized tools to the mesh.

Foundry semantic compilation is present from the restored donor lineage, but the full **semantic requirement → Foundry → runnable application** path is not yet complete. These five neural donors do **not** contain a literal `gate_neural_ops` module. The recovered trained Human Design GNN gives Synthia a real gate-level neural connection function, but it should not be falsely labeled as that missing module.

## Verification

New neural mesh suite:

`npm run test:synthia-neural-mesh`

It verifies:

- browser GNN reproduces trained PyTorch fixture
- GNN remains an independent callable node
- 64-node / 36-connection / 13-filter / five-view field
- connection-field training changes loss
- exact 34-entry process donor list remains preserved
- 36-edge active adapter remains separately identified
- emergent channel/junction behavior
- all 36 architecture families execute with finite outputs
- modulation changes activation without changing capability ownership
- Synthia mounts all neural nodes independently
- cues reach the connection field
- mesh snapshot does not expose neural weights
- verified outcomes reach the generative channel field

The full explicit current/restoration/donor chain is:

`npm run test:synthia-complete`

The Kimi donor is independently verified with:

`npm run test:synthia-kimi-donor`

## Still required

- precision live ephemeris / transit state
- Human Design bodygraph/definition feeding the GNN and mesh activation field
- end-to-end Foundry application synthesis
- Android-local Browser Hand executor
- physical Android build/acceptance
- reconciliation of unique organs from the verified r21.22 lineage

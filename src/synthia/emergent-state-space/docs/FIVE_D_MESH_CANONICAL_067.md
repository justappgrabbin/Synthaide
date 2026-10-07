# Synthia v0.6.7 — Canonical 5D Mesh

## Canonical rule

Synthia has one living state space with five simultaneous dimensions:

`Movement · Evolution · Being · Design · Space`

The mesh **is** that state space. It is not a graph layered over five dimensions and it is not a set of task/memory/workspace tables plus a graph index.

Every runtime object that Synthia knows, executes, remembers, waits on, creates, or depends on is represented as a five-field mesh state. Relationships and state changes are mesh transitions.

## Runtime objects now represented directly in the mesh

- tools and capabilities
- intents and execution events
- tasks and task steps
- immutable task-state snapshots
- checkpoints
- blockers through task-state attributes and relations
- explicit user authorizations
- memory gists
- artifacts/knowledge/embodiment states already carried by the mesh

Every state contains exactly the five canonical field keys. Field values are structural/runtime coordinates, not probabilities.

## Task continuity

A task is a trajectory, not a row:

`task -> has-step -> step`

`task -> has-task-state -> state(v1) -> task-advance -> state(v2) ...`

User-only boundaries create authorization states. Checkpoints capture exact task-state nodes. The ten-minute warm wait and exact resume semantics are retained, but the canonical state is the trajectory in the mesh.

## Memory and semantic completion

A memory gist is a derived five-field projection linked by `summarizes` edges to recorded evidence. Recall is deterministic cue/address matching followed by bounded local-neighborhood traversal.

Recall results are marked `derived`; the underlying matched nodes remain recorded evidence. Reconstruction never silently becomes recorded fact.

## Residency

`hot | warm | cold | external` is a property of mesh states. It determines what should be resident on-device; it is not a second storage ontology.

Large bytes can remain external while their artifact state and provenance remain in the mesh.

## ATO

ATO operates on the same state space. It resolves cues/state, activates the relevant neighborhood, invokes valid capabilities, and records the resulting trajectory back into the mesh.

## Supabase

Supabase is persistence infrastructure for the mesh and binary objects. `os_nodes` / `os_node_edges` are the existing physical persistence surfaces that most closely match the canonical model. Legacy semantic task/workspace tables are compatibility state from v0.6.1 and are not the desired long-term source of truth.

Migration must be compatibility-safe: backfill first, switch task RPCs to mesh-native persistence, verify exact continuity behavior, then retire the legacy semantic stores rather than dropping them blindly.

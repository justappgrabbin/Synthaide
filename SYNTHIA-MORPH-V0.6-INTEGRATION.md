# Synthia Morph v0.6 Integration

This build replaces the partial v0.3-only integration boundary with the complete supplied cumulative v0.6 substrate while preserving the existing Acode host, visual Morph runtime, Morph Chat, canonical addressing, transition resolver, Living Mesh, neural systems, native grammar, and Tool Factory.

## Live path

`artifact intake -> immutable original -> asset graph -> gap detection -> interface inference -> bridge candidate -> sandbox -> suggestion inbox -> approved workboard result`

The original is never the work surface. Builders and MCP tools receive capability-scoped copies on the Workboard. Accepted results become new immutable derivatives with lineage rather than overwriting their parents.

## Newly live capabilities

- Complete multi-asset Morph Engine and adapters
- Cross-file Asset Graph and Gap Detector
- Interface Inference and Bridge Builder
- AST rewriting and sandbox verification
- Suggestion Inbox and idle scout
- IndexedDB-backed immutable Personal Vault
- Duplicate sighting records and content-addressed deduplication
- Folder watcher API and folder-upload compatibility
- Workboard copies, derivative archival, and lineage
- Private artifact threads and contributions
- Capability-scoped MCP gateway with expiry, byte budgets, and revocation

## Runtime ownership

`src/synthia/morph-engine/substrateRuntime.mjs` is the composition boundary. It is canonically identified as `synthia-morph-substrate`, mounted as an independent Living Mesh component, indexed by the Transition Resolver, exposed in Synthia snapshots, and used by the Morph artifact-intake surface.

The earlier `changeRuntime.mjs` remains the governed source-change path. The v0.6 substrate supports it; it does not erase or impersonate it.

## Verification

The supplied v0.6 donor suites pass 6/6. The integrated runtime adds tests proving preservation-plus-diagnosis, immutable deduplication/sightings, and MCP copy isolation. The complete pre-existing Synthia suite and release audit also pass.

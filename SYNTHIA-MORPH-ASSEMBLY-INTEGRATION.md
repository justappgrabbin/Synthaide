# Synthia Morph v0.3 + Asset Graph + Resonance Integration

## Active runtime path

`address -> identity -> Asset Graph -> Gap Detector -> Morph AST candidate -> Sandbox -> Suggestion Inbox -> approval -> controlled apply -> learning evidence`

The v0.3 donor archive is **not** in this app package. Only the integrated working modules are present.

## Integrated Morph v0.3 capabilities

- AST project analysis and verified JavaScript rewrites
- sandbox static verification
- browser runtime verification where supported
- suggestion inbox with pending / approved / rejected / applied states
- idle suggestion scout
- approved-only change applicator

## Asset Graph

The Asset Graph represents addressed entities and source/runtime relationships. Supported entity kinds include:

- person
- place
- thing
- agent
- tool
- capability
- project
- artifact
- component
- file

It separates expected relationships from observed relationships so missing wiring can be detected instead of guessed.

## Gap Detector

The Gap Detector currently detects:

- declared relationship missing from the observed graph
- required capability with no provider
- unresolved relative source import

A detected gap may become a Morph candidate. If no safe source transformation can be inferred, the gap is placed in the Suggestion Inbox as `needs-design` rather than silently mutating the application.

## Resonance Network

People, places, things, agents, tools, and artifacts can be registered by canonical identity/address and related through the existing Living Mesh Resonance Network.

Verified outcomes update bounded relationship weights. Private entity state is not copied into the public resonance snapshot.

## Shipping rule

The app package contains:

- the working integrated runtime
- the minimal active semantic-mesh dependency closure
- the integrated Morph v0.3 modules actually used
- active verification tests

It contains:

- no donor ZIP archives
- no donor test warehouse
- no `restored-systems/` donor tree
- no nested compressed archives

## Verification

Current integrated test chain:

- Synthia core: 38/38
- Living Mesh: 7/7
- Neural Mesh: 8/8
- VQ-VAE trigger: 5/5
- Self-integration / Morph / resonance: 6/6

Total: **64/64**

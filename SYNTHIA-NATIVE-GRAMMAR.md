# Synthia Native Grammar

## Purpose

This runtime implements a deliberately small reasoning curriculum:

`State = Primitive × Position × Relation × Scale × Context`

`Understanding = Translate → Locate → Relate → Scale → Test → Remember`

The engine treats interpretations as hypotheses. Observation can support, condition, contradict, or leave them unresolved. `unresolved` never means `absent`.

## Primitive basis

The active basis contains exactly 64 slots.

The first worked vocabulary uses the integrated 64-gate table already present in Synthia. Each primitive record can hold:

- name;
- meaning;
- aliases;
- complements;
- channel partners;
- examples;
- provenance.

Unknown complement information remains unresolved rather than inferred from channel relationships.

`primitive.teach` can extend a slot without changing the 64-slot basis.

## Position grammar

The jobs are stable across domains:

- `P`: source / primitive
- `D`: domain / dimension
- `G`: semantic state
- `L`: expression / behavior
- `C`: motivation / constraint
- `T`: perception / sense
- `B`: underlying orientation

Domain-specific labels may change; the jobs do not.

## Relationship grammar

- same / identity / similarity → resonance
- cross / counterpart / complement → harmony
- other → dissonance

Ordinary contact is local to the same scale or one scale above/below. Cross/counterpart relations are explicit rather than arbitrary jumps.

## Scale operators

- `FOLD`
- `UNFOLD`
- `UP`
- `DOWN`
- `CROSS`
- `PIVOT`

## Reality correction

Predicted structure is compared with observation:

- supported
- conditional
- contradicted
- unresolved

Independent observations are retained as evidence associations rather than converted directly into universal claims.

## AutoLing

AutoLing is the outside-language adapter. The native grammar remains usable when AutoLing is unavailable, but the live Synthia mesh binds the existing `autoling` node so ordinary language can be analyzed before canonical reasoning.

## Current domain adapters

- Human Design
- language / generative grammar
- code
- generic structured input

The same core loop is used for all of them.

Human Design is the first worked primitive vocabulary. The implementation does not claim that Human Design, or the scale-invariant hypothesis itself, has been empirically established as a universal ontology. The runtime is specifically designed to test interpretations against observation and retain contradictions/unresolved cases.

## Live path

`cue → canonical address → Living Mesh → Native Grammar → AutoLing → Translate → Locate → Relate → Scale → Test → Remember`

The native grammar is an addressed mesh capability and its internal parts are also identified/addressed under the current component-intake law.

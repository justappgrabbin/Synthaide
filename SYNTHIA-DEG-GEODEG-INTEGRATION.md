# Synthia DEG + Geo-DEG Integration

## Purpose

This checkpoint adapts two research ideas into dependency-free, browser-native Synthia automatons without merging their ownership or state.

### DEG: `deg-grammar-learner`

`src/synthia/deg/grammar.mjs`

- Accepts strings or generic `{nodes, edges}` graphs.
- Extracts connected edge/path motifs from small example sets.
- Scores recurrent motifs and materializes executable production rules.
- Generates new generic graphs by applying learned rules.
- Can be mounted and called with no Geo-DEG runtime present.

This is a domain-general adaptation of the reusable graph-grammar mechanism. It is not a drop-in port of the repository's molecular RDKit/PyTorch/Retro* training stack.

### Geo-DEG: `geo-deg-grammar-geometry`

`src/synthia/geo-deg/geometry.mjs`

- Accepts any compatible production grammar as data.
- Builds an explicit relational geometry over rules.
- Exposes similarity neighborhoods.
- Computes weighted reachability/routes.
- Composes paths.
- Performs dependency-free signal diffusion over the geometry.
- Can be mounted and called with no DEG learner present.

This is a domain-general adaptation of grammar-induced geometry. It is not the paper's molecular GNN predictor or trained model.

## Shared roof

`src/synthia/grammarSystemsRuntime.mjs`

The helper mounts both independent automatons into an `AutomataMesh` and connects only their declared `production-grammar` contract. DEG's grammar output can therefore trigger Geo-DEG geometry construction while both states remain separately owned.

## UI

Settings → Learning / Grammar Geometry opens a functional test surface:
- enter a tiny example set,
- learn DEG rules,
- index Geo-DEG geometry,
- inspect rule/relationship counts,
- generate a graph.

## Verification

Run:

```sh
npm run test:synthia-all
```

The grammar suite proves each automaton runs independently and that the shared-roof contract works when they are connected.

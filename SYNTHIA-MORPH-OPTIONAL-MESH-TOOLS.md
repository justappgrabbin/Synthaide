# Morph Chat Optional DEG / Geo-DEG Mesh Tools

Morph Chat does not import DEG or Geo-DEG implementations.

`src/synthia/morph-chat/optionalMeshTools.mjs` discovers capabilities exposed
by any attached `AutomataMesh` and calls them only when a message explicitly
requests grammar or grammar-geometry work.

## Capability contracts

DEG advertises:

- `grammar.learn`
- `grammar.generate`
- `grammar.snapshot`

Geo-DEG advertises:

- `geometry.build`
- `geometry.neighbors`
- `geometry.route`
- `geometry.diffuse`
- `geometry.compose`
- `geometry.snapshot`

The Residence composition root attaches the grammar systems mesh with:

```js
morphChat.attachToolMesh(grammarSystems.mesh);
```

This is composition, not ownership. Morph Chat's own mesh does not receive the
DEG or Geo-DEG automatons. Removing the external mesh leaves Morph Chat usable.

A combined request such as:

```text
Learn a grammar and build Geo-DEG geometry from:
alpha beta gamma; alpha beta delta; beta gamma epsilon
```

causes Morph to request `grammar.learn`, pass that returned grammar as message
data into `geometry.build`, and then realize the results in conversation.
DEG and Geo-DEG continue to own separate state objects.

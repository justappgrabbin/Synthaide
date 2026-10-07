# Synthia Morph Integration Checkpoint

This checkpoint preserves the Acode/Cordova host and mounts the user-supplied Morph work as separate capabilities.

## Donors

- `morph_engine_js.zip`: browser Morph Engine, copied as `src/synthia/morph-engine/morph-engine.js`.
- `morph_engine.zip`: Python reference implementation; kept as a reference donor rather than bundled into Cordova.
- `Generative-Morph-Chat (1).zip`: semantic-mesh/chat architecture donor adapted into `src/synthia/morph-chat/`.
- Existing ATO Core: shared mesh, trace firing, VQ-VAE, semantic completion, Klein tools.
- Existing Tool Factory: independent synthesis subsystem.

## Runtime boundaries

- `MorphVisualRuntime` bridges the standalone visual Morph Engine into the shell.
- `MorphChatRuntime` is its own ATO Automaton.
- Eight Klein tools and the computational grammar coder are independent mesh members.
- Four dimensional perspective readers (Movement, Evolution, Being, Design) remain independent automatons.
- Space/View integrates their proportions; it is not another competing perspective.
- Final language realization is replaceable through a provider boundary.

## Residence UI

Primary navigation now exposes Residence, Morph, Morph Chat, and Settings.
State Space, Builder/ATO machinery, and Autonomy remain available from Settings.
Panels are cached so Morph Chat/UI state survives navigation within the Residence.

## Verification

Run:

```sh
npm run test:synthia-all
```

The dependency-free Node suites cover the original synthesis MVP plus Morph runtime, trace activation, Klein independence, perspective proportions, coding chat, multi-turn memory, provider replacement/fallback, and UI routing contracts.

A full Rspack/Android build still requires the repository's npm/Cordova dependencies.

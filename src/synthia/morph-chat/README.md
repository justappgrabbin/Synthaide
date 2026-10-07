# Morph integration

This folder is the Acode-native Morph Chat runtime.

Sources preserved separately:

- `../morph-engine/morph-engine.js` is the supplied standalone browser Morph Engine.
- The supplied `Generative-Morph-Chat` prototype informed the semantic mesh,
  chat-phase state machine, 5D artifact interpretation, and Morph surface.
- ATO Core remains the executable host; Klein tools remain independent
  automatons called by Morph rather than code copied into Morph.

Morph Chat owns conversation orchestration and session memory. It does not own
Klein tools, the visual Morph Engine, Tool Factory, or model weights.

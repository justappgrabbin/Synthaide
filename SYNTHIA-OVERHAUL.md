# Synthia OS — Acode Overhaul

This package keeps Acode's editor, filesystem, terminal, plugin loader, preview server, and native Cordova integration, then replaces the welcome/residence surface with Synthia OS.

## Implemented

- Synthia visual system based on the supplied reference: midnight/cyan/violet shell, generated state-space hero, app tray, system vitality, and fixed residence navigation.
- App-only icon rule: Files, Editor, Terminal, Preview, Plugins, and Settings receive launcher tiles. Automata and tools appear as internal machinery rows.
- Five-dimensional state substrate: Movement, Evolution, Being, Design, Space; 64 gate nodes each; 320 total.
- Complete deterministic 13-field address: planetary, dimension, gate, line, color, tone, base, degree, minute, second, arc/axis, zodiac, house.
- ATO engine with Idler, Recognizer, Placer, Rememberer, Speaker, Corrector, and Weaver.
- Full dependency-free ATO Core mounted under `src/synthia/ato-core`, including native `Automaton`/`AutomataMesh`, Klein/I Ching mechanisms, trace firing, VQ-VAE discrete traces, and semantic completion.
- Integrated eight-level Tool Factory mounted under `src/synthia/integrated-tool-factory`, with native ATO bridging for Base, Tone, Color, Bigram, Trigram, Hexagram, Channel, and Circuit tools.
- `src/synthia/synthesisRuntime.mjs` provides the mobile MVP path: purpose -> generate -> native ATO materialize -> mesh mount -> run -> export.
- Foundation Tool Factory still registers AUTOLING, DISEMINER, Control of Style, and Paraphraser jobs for intake/routing.
- Meaning-first sentence realization is available as `src/synthia/sentenceRealization.mjs` for complete 9-layer coordinates.
- Autonomy controls: master pause, file-read/write, execution, network, write approval, action budget, pulse interval, and local audit.
- Synthia Android name, URI scheme, dark launcher background, and Synthia visual assets.

## Verification

- `npm run test:synthia-mvp`: 5/5 passing in this integration package. It proves native ATO generation/mount/run/export, semantic-completion field preservation, and sentence realization.
- The donor ATO Core test suite: 88/88 passing before integration.
- The previous build-ready package reported its Synthia Vitest tests, TypeScript check, and Rspack frontend bundle passing before these additions.
- A fresh full `npm test`, `npm run typecheck`, and frontend build still require the Acode npm dependency install on the build machine.

## Build APK

The source is prepared for Cordova Android 15.1.0. An Android SDK/JDK machine can run:

```bash
npm install
npx cordova platform add android@15.1.0
npm run build
```

This workspace did not have `ANDROID_HOME` or an Android SDK, so no APK is included. The failure occurred only after the frontend compiled successfully and Cordova reached its Android SDK check.

## Architecture boundary

This overhaul now supplies a working deterministic Synthia substrate, residence, native ATO mesh, and an executable local synthesis vertical slice. It does not claim that generated bounded structural tools equal arbitrary program synthesis, or that ATO can safely mutate arbitrary projects without further host adapters. Foundation tools register through `src/synthia/toolFactory.js`; generated tools flow through `src/synthia/synthesisRuntime.mjs`; native effects should remain gated through `src/synthia/autonomy.js`.

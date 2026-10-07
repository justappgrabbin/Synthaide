# Synthia MVP Integration Map

## Host

`Synthia-OS-Acode-Overhaul-v1.0.0-build-ready.zip` remains the application host. It is the complete Acode/Cordova mobile project in this upload set.

## Runtime pieces integrated

- `ato-core-trace-firing.zip` -> `src/synthia/ato-core/`
  - native Automaton and AutomataMesh runtime
  - addressed state/activation mechanisms
  - trace firing
  - VQ-VAE discrete trace compression
  - semantic completion
- `integrated-tool-factory-v1_4_0.zip` -> `src/synthia/integrated-tool-factory/`
  - eight structural synthesis levels
  - deterministic generated tools
  - native ATO bridge
  - standalone export
- `sentence_realization.js` -> `src/synthia/sentenceRealization.mjs`
  - converted from CommonJS to browser-ready ESM
  - uses the ATO trace coordinate schema

The standalone `vqvae.js` and `semantic_completion.js` are not duplicated into the app because their functionality is already incorporated by the newer tested `ato-core/trace-firing.mjs` implementation.

## Donors intentionally not wholesale merged

- `Foundry-Glyphs.zip`
- `SynthAI-Foundry-QQMOD-Replit-Drop.zip`
- `Flask.zip`

Those are separate application/server donors. Copying their UIs, servers, Git history, and dependency trees into Acode would create duplicate hosts and increase mobile build risk. They remain source/reference donors for later Foundry, neural-cartridge, and backend work.

## MVP user path

1. Launch Synthia OS.
2. Open **Machinery**.
3. Enter a tool purpose.
4. Pick a dimension and optional structure level.
5. Tap **Synthesize + mount**.
6. The Integrated Tool Factory generates a deterministic tool.
7. The native bridge materializes it as an ATO `Automaton`.
8. The ATO mesh mounts it.
9. Enter input on the generated tool card and tap **Run**.
10. The output renders in the card.

Typing a build/create/make request into the Residence Resolve box also synthesizes and mounts a tool automatically using the resolved state-space dimension.

## Local smoke test

```sh
npm run test:synthia-mvp
```

This test has no external runtime dependencies and covers:

- generate -> native ATO mount -> run
- zero-import standalone tool export
- semantic completion preserving known coordinate fields
- meaning-first sentence realization

## MVP boundary

Working now:
- deterministic local synthesis
- 8 reachable structural tool levels
- native ATO mounting
- local execution
- standalone source export API
- trace/VQ/semantic-completion engine available in the host
- existing Acode editor/files/terminal/plugins/native shell retained

Not yet production-complete:
- persisted generated-tool registry across app restarts
- user-facing export/save button for generated `.mjs` souvenirs
- arbitrary code generation
- full Foundry neural-cartridge manufacturing lifecycle
- Android APK build in this container

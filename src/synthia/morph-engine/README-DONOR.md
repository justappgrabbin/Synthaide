# Morph Engine (JavaScript)

Browser port of the sprite-state Morph Engine. One-page HTML + one engine file. No build step.

```
morph_engine_js/
  morph-engine.js   engine, character, edges, test harness API
  index.html        executable transition test (runs on load)
  README.md
```

Open `index.html` in a browser (or serve the folder). The test runs immediately.

```js
const { MorphEngine, renderCharacter, poseIdle, poseReach } = MorphEngineLib;

const engine = new MorphEngine();
const a = engine.registerState(renderCharacter(poseIdle(), "idle"));
const b = engine.registerState(renderCharacter(poseReach(), "reach"));

const { frames, edge, report } = engine.morph(a, b, {
  frames: 8,
  learn: true,
  easing: "smoothstep",
});
// frames[0] === A, frames[n] === B, ImageData + canvas on each
```

Transition edges persist in `localStorage` under `morph-edge:{from}__{to}`.

Same architecture as the Python engine: landmarks → mesh → motion → joint interpolation → per-bone canonical texture warp → secondary motion → validator. Hidden torso texture lives on the torso layer so a crossing arm occludes it and then reveals it — it is not a pixel dissolve.

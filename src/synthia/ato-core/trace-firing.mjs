// trace-firing.mjs
//
// Implements the architecture from Fayyaz et al. 2022 ("A Model of Semantic
// Completion in Generative Episodic Memory") as Synthia's firing system:
//
//   cue/experience -> VQ-VAE discrete latent trace -> trace reactivation/match
//     -> ATO fires -> circuit executes -> semantic completion fills missing
//     context -> result
//
// Design constraints this module is built to (from the architecture note):
//   - The VQ-VAE trace is a compact FIRING IDENTITY, not the operational
//     payload. Automatons stay tiny; they receive the real cue, not the trace.
//   - Activation is SPARSE: encoding a cue always produces a trace (nearest
//     codebook entry), but a trace only fires something if it has been
//     LEARNED (bound) to an Automaton. Unbound traces produce no activation.
//   - Semantic completion is generative, not authoritative. It can return a
//     plausible reconstruction, not a bit-for-bit original. The original cue
//     is therefore always preserved and returned alongside the completion,
//     never overwritten by it.
//
// No dependency on any other module's internals — only automaton.mjs's public
// Automaton/AutomataMesh API, matching the rest of this codebase's
// dependency-free, addressed-executable philosophy.

// ---------------------------------------------------------------------------
// Coordinate schema: the same 9-layer address this engine already uses
// (macro GLCTB fields, plus sign/house). dimension/center are Synthia-side
// concepts layered on top for firing purposes; gate/line/color/tone/base
// match address-space.mjs's own fields directly.
// ---------------------------------------------------------------------------
export const TRACE_LAYERS = Object.freeze([
  { name: 'dimension', k: 5 },
  { name: 'center', k: 9 },
  { name: 'gate', k: 64 },
  { name: 'line', k: 6 },
  { name: 'color', k: 6 },
  { name: 'tone', k: 6 },
  { name: 'base', k: 5 },
  { name: 'sign', k: 12 },
  { name: 'house', k: 12 },
]);
const INPUT_DIM = TRACE_LAYERS.reduce((s, l) => s + l.k, 0);

export class TraceFiringError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'TraceFiringError'; this.code = code; this.details = details; }
}

// ---------------------------------------------------------------------------
// Minimal numeric primitives (no external ML library — same policy as the
// rest of ato_build having zero runtime dependencies).
// ---------------------------------------------------------------------------
function zeros(n) { return new Array(n).fill(0); }
function randMat(rows, cols, scale) {
  const m = new Array(rows);
  for (let i = 0; i < rows; i++) { m[i] = new Array(cols); for (let j = 0; j < cols; j++) m[i][j] = (Math.random() * 2 - 1) * scale; }
  return m;
}
function matVec(W, x) { const out = zeros(W.length); for (let i = 0; i < W.length; i++) { let s = 0; const row = W[i]; for (let j = 0; j < row.length; j++) s += row[j] * x[j]; out[i] = s; } return out; }
function addInPlace(a, b) { for (let i = 0; i < a.length; i++) a[i] += b[i]; return a; }
function relu(x) { return x.map((v) => Math.max(0, v)); }
function reluGrad(pre) { return pre.map((v) => (v > 0 ? 1 : 0)); }
function softmax(x) { const m = Math.max(...x); const ex = x.map((v) => Math.exp(v - m)); const s = ex.reduce((a, b) => a + b, 0); return ex.map((v) => v / s); }
function oneHot(k, idx) { const v = zeros(k); if (idx !== undefined && idx !== null) v[idx] = 1; return v; }

class Dense {
  constructor(inDim, outDim, scale) { this.W = randMat(outDim, inDim, scale || Math.sqrt(2 / inDim)); this.b = zeros(outDim); }
  forward(x) { return addInPlace(matVec(this.W, x), this.b); }
  backward(x, dOutPre, lr) {
    const dX = zeros(x.length);
    for (let i = 0; i < this.W.length; i++) {
      const g = dOutPre[i]; if (g === 0) continue;
      const row = this.W[i];
      for (let j = 0; j < row.length; j++) { dX[j] += row[j] * g; row[j] -= lr * g * x[j]; }
      this.b[i] -= lr * g;
    }
    return dX;
  }
}

function encodeCue(cue) {
  // Unknown/omitted layers encode as an all-zero segment (no assertion made),
  // not a guess — that is what lets a partial cue still land on a trace.
  const vec = [];
  for (const layer of TRACE_LAYERS) vec.push(...oneHot(layer.k, cue[layer.name]));
  return vec;
}

// ---------------------------------------------------------------------------
// VQ-VAE: compresses a (possibly partial) cue into a discrete trace index.
// ---------------------------------------------------------------------------
export class VQVAE {
  constructor({ latentDim = 24, hiddenDim = 48, codebookSize = 32 } = {}) {
    this.latentDim = latentDim; this.hiddenDim = hiddenDim; this.codebookSize = codebookSize;
    this.encL1 = new Dense(INPUT_DIM, hiddenDim);
    this.encL2 = new Dense(hiddenDim, latentDim);
    this.codebook = randMat(codebookSize, latentDim, 1.0);
    this.decL1 = new Dense(latentDim, hiddenDim);
    this.heads = TRACE_LAYERS.map((l) => new Dense(hiddenDim, l.k));
  }

  encode(x) { const h1pre = this.encL1.forward(x); const h1 = relu(h1pre); const z = this.encL2.forward(h1); return { x, h1pre, h1, z }; }

  quantize(z) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < this.codebook.length; i++) {
      let d = 0; for (let j = 0; j < z.length; j++) { const diff = z[j] - this.codebook[i][j]; d += diff * diff; }
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return { index: best, zq: this.codebook[best].slice(), distance: bestDist };
  }

  decode(zq) { const h2pre = this.decL1.forward(zq); const h2 = relu(h2pre); const logitsPerLayer = this.heads.map((h) => h.forward(h2)); return { h2pre, h2, logitsPerLayer }; }

  // Encode + quantize a (partial) cue -> discrete trace. This IS the compact
  // firing identity described in the architecture note.
  traceOf(cue) {
    const x = encodeCue(cue);
    const enc = this.encode(x);
    const q = this.quantize(enc.z);
    return q.index;
  }

  forward(cue) { const x = encodeCue(cue); const enc = this.encode(x); const q = this.quantize(enc.z); const dec = this.decode(q.zq); const probsPerLayer = dec.logitsPerLayer.map(softmax); return { x, enc, q, dec, probsPerLayer }; }

  trainStep(cue, lr = 0.03, beta = 0.25) {
    const { x, enc, q, dec, probsPerLayer } = this.forward(cue);
    let dH2 = zeros(this.hiddenDim), ceLoss = 0;
    TRACE_LAYERS.forEach((layer, li) => {
      const target = cue[layer.name]; if (target === undefined || target === null) return; // only trained layers contribute loss
      const p = probsPerLayer[li];
      ceLoss += -Math.log(Math.max(p[target], 1e-9));
      const dLogits = p.slice(); dLogits[target] -= 1;
      dH2 = addInPlace(dH2, this.heads[li].backward(dec.h2, dLogits, lr));
    });
    const dH2pre = dH2.map((g, i) => g * reluGrad(dec.h2pre)[i]);
    const dZq = this.decL1.backward(q.zq, dH2pre, lr);
    const embedding = this.codebook[q.index]; let vqLoss = 0;
    for (let j = 0; j < embedding.length; j++) { const diff = enc.z[j] - embedding[j]; vqLoss += diff * diff; embedding[j] += lr * diff; }
    const dZ = dZq.map((g, j) => g + beta * 2 * (enc.z[j] - embedding[j]));
    const dH1 = this.encL2.backward(enc.h1, dZ, lr);
    const dH1pre = dH1.map((g, i) => g * reluGrad(enc.h1pre)[i]);
    this.encL1.backward(x, dH1pre, lr);
    return { ceLoss, vqLoss, trace: q.index };
  }

  train(cues, epochs = 200, lr = 0.03) { for (let e = 0; e < epochs; e++) for (const cue of cues) this.trainStep(cue, lr); return this; }
}

// ---------------------------------------------------------------------------
// Semantic completion: restores full-resolution structure from a partial
// cue. Generative — returns a plausible fill, not a guaranteed original.
// ---------------------------------------------------------------------------
export class SemanticCompletion {
  constructor({ hiddenDim = 32 } = {}) {
    this.hiddenDim = hiddenDim;
    let prefixDim = 0;
    this.stages = TRACE_LAYERS.map((layer) => {
      const stage = { inDim: prefixDim, l1: prefixDim > 0 ? new Dense(prefixDim, hiddenDim) : null, l2: new Dense(prefixDim > 0 ? hiddenDim : 1, layer.k) };
      prefixDim += layer.k; return stage;
    });
  }
  _prefixVec(cue, uptoIdx) { const vec = []; for (let i = 0; i < uptoIdx; i++) vec.push(...oneHot(TRACE_LAYERS[i].k, cue[TRACE_LAYERS[i].name])); return vec; }
  _forwardStage(i, prefixVec) {
    const stage = this.stages[i];
    if (stage.inDim === 0) { const logits = stage.l2.forward([1]); return { probs: softmax(logits), cache: { input: [1] } }; }
    const h1pre = stage.l1.forward(prefixVec); const h1 = relu(h1pre); const logits = stage.l2.forward(h1);
    return { probs: softmax(logits), cache: { h1pre, h1, input: prefixVec } };
  }
  trainStep(cue, lr = 0.05) {
    TRACE_LAYERS.forEach((layer, i) => {
      const target = cue[layer.name]; if (target === undefined || target === null) return;
      const prefix = this._prefixVec(cue, i);
      const { probs, cache } = this._forwardStage(i, prefix);
      const dLogits = probs.slice(); dLogits[target] -= 1;
      const stage = this.stages[i];
      if (stage.inDim === 0) stage.l2.backward(cache.input, dLogits, lr);
      else { const dH1 = stage.l2.backward(cache.h1, dLogits, lr); const dH1pre = dH1.map((g, j) => g * reluGrad(cache.h1pre)[j]); stage.l1.backward(cache.input, dH1pre, lr); }
    });
  }
  train(cues, epochs = 300, lr = 0.05) { for (let e = 0; e < epochs; e++) for (const cue of cues) this.trainStep(cue, lr); return this; }

  // Returns a FULL coordinate. Fields present in `cue` are copied through
  // exactly (confidence 1.0); fields missing from `cue` are filled by the
  // network (confidence = the probability it assigned).
  complete(cue) {
    const filled = {}, confidence = {};
    TRACE_LAYERS.forEach((layer, i) => {
      const known = cue[layer.name];
      if (known !== undefined && known !== null) { filled[layer.name] = known; confidence[layer.name] = 1.0; return; }
      const prefix = this._prefixVec(filled, i);
      const { probs } = this._forwardStage(i, prefix);
      const choice = probs.indexOf(Math.max(...probs));
      filled[layer.name] = choice; confidence[layer.name] = probs[choice];
    });
    return { filled, confidence };
  }
}

// ---------------------------------------------------------------------------
// TraceFiringRegistry: the sparse trace -> Automaton binding table, and the
// fire() pipeline that ties VQ-VAE + a real AutomataMesh (from automaton.mjs)
// + semantic completion together. This is intentionally the only "router"-
// shaped piece — everything it routes to is a tiny, addressed Automaton.
// ---------------------------------------------------------------------------
export class TraceFiringRegistry {
  constructor({ vqvae = new VQVAE(), completion = new SemanticCompletion(), mesh } = {}) {
    if (!mesh) throw new TraceFiringError('MISSING_MESH', 'TraceFiringRegistry requires an AutomataMesh to fire into');
    this.vqvae = vqvae;
    this.completion = completion;
    this.mesh = mesh;
    this.bindings = new Map(); // trace index -> automatonId
    this.experiences = []; // preserved original high-resolution cues, never overwritten by completion
  }

  // Learn that a trace should fire a specific Automaton. This is the
  // "learned trace/address relationship" the architecture note refers to.
  bind(trace, automatonId) {
    if (!this.mesh.automatons.has(automatonId)) throw new TraceFiringError('UNKNOWN_AUTOMATON', `Cannot bind trace ${trace} to unknown Automaton ${automatonId}`);
    this.bindings.set(trace, automatonId);
    return { trace, automatonId };
  }

  // Convenience: encode a cue, bind its trace to an Automaton in one step.
  learn(cue, automatonId) {
    const trace = this.vqvae.traceOf(cue);
    return { trace, ...this.bind(trace, automatonId) };
  }

  // The full pipeline: cue -> trace -> (sparse) activation -> circuit
  // execution -> semantic completion -> result. The original cue is always
  // preserved verbatim in the returned record and in this.experiences.
  async fire(cue, { context = {} } = {}) {
    const trace = this.vqvae.traceOf(cue);
    const automatonId = this.bindings.get(trace) ?? null;

    const record = { cue: Object.freeze({ ...cue }), trace, automatonId, activated: automatonId !== null };
    this.experiences.push(Object.freeze({ ...record }));

    if (!automatonId) {
      // Sparse activation: an unbound trace fires nothing. This is not a
      // failure — most traces should not have a learned circuit yet.
      return Object.freeze({ ...record, circuitResult: null, completion: null });
    }

    const automaton = this.mesh.automatons.get(automatonId);
    const circuitResult = await automaton.call(cue, context); // ATO receives the real cue, not the trace
    const { filled, confidence } = this.completion.complete(cue); // restore full resolution afterward

    return Object.freeze({ ...record, circuitResult, completion: Object.freeze({ filled, confidence }) });
  }

  snapshot() {
    return Object.freeze({
      bindings: Object.freeze(Object.fromEntries(this.bindings)),
      experienceCount: this.experiences.length,
      codebookSize: this.vqvae.codebookSize,
    });
  }
}

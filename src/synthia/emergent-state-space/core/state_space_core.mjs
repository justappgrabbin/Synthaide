// state_space_core.mjs
//
// Real 5-dimension x 64-node state space engine.
//
// Dimension -> mesh-layer role -> I-Ching sequence -> chart-method,
// per direct correction (Aug 12 2026):
//   - Movement  = knowledge  layer
//   - Evolution = causal     layer, Mawangdui sequence, Sidereal
//   - Being     = state      layer, Fuxi sequence,      Tropical  (chart carried over from
//                                                                  earlier established Mind/Body/Heart
//                                                                  triad — NOT reconfirmed this turn,
//                                                                  flag if wrong)
//   - Design    = temporal   layer, King Wen sequence,  Draconic
//   - Space     = dependency layer
//
// NO Crystals / Magnetic Monopole framing anywhere in this file — explicitly rejected
// for the state space by direct instruction. That framing lives only in the JUT source
// material notes, not here.
//
// Movement's and Space's sequence (below: reverse / complement) are NOT yet confirmed
// by the user — they're the two remaining named transforms already real and verified
// elsewhere in this project (gateReverse, complement = fuxi ^ 63), assigned here as the
// most reasonable default since every other dimension already has a named sequence and
// these were the only two left. Flag/override if wrong.
//
// This module does NOT embed a 64-gate binary/trigram table. The project already has
// one, independently verified (organism.html's GATE_BINARY/GATE_TRIGRAMS, cross-checked
// against Govinda's Abstract Order, gates 7/8 transposition caught and fixed twice
// already in this project's history). Re-typing a second competing table from memory
// here would risk reintroducing exactly that class of bug. Pass the real table in.

export const DIMENSIONS = {
  Movement:  { layerRole: 'knowledge',  sequence: 'reverse',    chart: null,       confirmed: false },
  Evolution: { layerRole: 'causal',     sequence: 'mawangdui',  chart: 'sidereal', confirmed: true },
  Being:     { layerRole: 'state',      sequence: 'fuxi',       chart: 'tropical', confirmed: 'partial' },
  Design:    { layerRole: 'temporal',   sequence: 'kingwen',    chart: 'draconic', confirmed: true },
  Space:     { layerRole: 'dependency', sequence: 'complement', chart: null,       confirmed: false },
};

// Real Mawangdui upper-trigram family order (sourced, not guessed):
// the manuscript groups all 64 hexagrams into 8 octets by upper trigram,
// in this family order: Qian, Gen, Kan, Zhen, Kun, Dui, Li, Xun.
// Within each octet this implementation sorts by lower trigram in the same
// family order — the documented organizing PRINCIPLE, not a verbatim
// byte-for-byte transcription of the manuscript's own internal per-octet
// shift pattern (that finer detail is real but not yet sourced here — flagged,
// not faked).
export const MAWANGDUI_TRIGRAM_FAMILY = ['Kian', 'Gen', 'Kan', 'Jen', 'Kun', 'Dui', 'Li', 'Sun'];

function fuxiValue(gate) {
  // Real binary-order value: read bottom-to-top, yin=0/yang=1, line1=LSB.
  return gate.binary.reduce((acc, bit, i) => acc | (bit << i), 0);
}

function fuxiOrder(gates) {
  return [...gates].sort((a, b) => fuxiValue(a) - fuxiValue(b));
}

function kingWenOrder(gates) {
  // Gate numbers ARE King Wen numbers under the Human Design / standard convention
  // already used throughout this project — identity sort, not a separate table.
  return [...gates].sort((a, b) => a.gate - b.gate);
}

function mawangduiOrder(gates) {
  const idx = (t) => MAWANGDUI_TRIGRAM_FAMILY.indexOf(t);
  return [...gates].sort((a, b) => {
    const byUpper = idx(a.trigrams.upper) - idx(b.trigrams.upper);
    if (byUpper !== 0) return byUpper;
    return idx(a.trigrams.lower) - idx(b.trigrams.lower);
  });
}

function reverseOf(gate) {
  // Real verified transform already used elsewhere in this project: line-order
  // reversal, a genuine involution (reverse(reverse(x)) === x).
  return { ...gate, binary: [...gate.binary].reverse() };
}

function complementOf(gate) {
  // Real verified transform already used elsewhere in this project: fuxi ^ 63,
  // i.e. flip every line.
  return { ...gate, binary: gate.binary.map((b) => (b ^ 1)) };
}

class DimensionLayer {
  constructor(name, spec, gateTable) {
    this.name = name;
    this.layerRole = spec.layerRole;
    this.sequenceName = spec.sequence;
    this.chart = spec.chart;
    this.confirmed = spec.confirmed;
    // Real per-layer word registry, keyed by word id — this is what makes
    // cross-word dependency checkable: a word can depend on any other word
    // already registered in THIS dimension, not just ones in the same node.
    this._wordRegistry = new Map();
    this.nodes = this._order(gateTable).map((g) => ({
      gate: g.gate,
      binary: g.binary,
      trigrams: g.trigrams,
      // Real, honest, empty hook — NOT fabricated book content. It's not just
      // node order that matters (direct correction) — it's the actual words,
      // how they sit, and which ones depend on which. Stays empty until
      // addWord() is called with real content from the source books.
      content: { words: [], rules: [] },
    }));
  }

  _order(gateTable) {
    switch (this.sequenceName) {
      case 'fuxi': return fuxiOrder(gateTable);
      case 'kingwen': return kingWenOrder(gateTable);
      case 'mawangdui': return mawangduiOrder(gateTable);
      case 'reverse': return kingWenOrder(gateTable).map(reverseOf);
      case 'complement': return kingWenOrder(gateTable).map(complementOf);
      default: throw new Error(`Unknown sequence: ${this.sequenceName}`);
    }
  }

  // Real word-level content with real dependency edges. dependsOn must already
  // exist in this layer's registry (any gate, not just the same one) — you
  // can't declare a dependency on a word that isn't there yet, so the
  // dependency graph can never silently point at nothing.
  addWord(gateNum, { id, text, dependsOn = [], relation = null }) {
    const node = this.nodes.find((n) => n.gate === gateNum);
    if (!node) throw new Error(`Gate ${gateNum} not found in ${this.name} layer`);
    if (this._wordRegistry.has(id)) {
      throw new Error(`Word id "${id}" already exists in ${this.name} layer`);
    }
    for (const depId of dependsOn) {
      if (!this._wordRegistry.has(depId)) {
        throw new Error(
          `"${id}" depends on "${depId}", which doesn't exist yet in ${this.name} — add dependencies before dependents`
        );
      }
    }
    const entry = { id, text, gate: gateNum, dependsOn: [...dependsOn], relation };
    node.content.words.push(entry);
    this._wordRegistry.set(id, entry);
    return entry;
  }

  // Real reverse-lookup: which words (anywhere in this dimension) depend on
  // the given one. Needed to answer "how are they dependent" in both
  // directions, not just forward.
  dependentsOf(wordId) {
    const out = [];
    for (const entry of this._wordRegistry.values()) {
      if (entry.dependsOn.includes(wordId)) out.push(entry);
    }
    return out;
  }

  wordCount(gateNum) {
    const node = this.nodes.find((n) => n.gate === gateNum);
    return node ? node.content.words.length : 0;
  }

  letterCount(gateNum) {
    const node = this.nodes.find((n) => n.gate === gateNum);
    if (!node) return 0;
    return node.content.words.reduce(
      (sum, w) => sum + w.text.replace(/[^a-zA-Z]/g, '').length,
      0
    );
  }

  totalWordCount() {
    return this.nodes.reduce((sum, n) => sum + n.content.words.length, 0);
  }

  totalLetterCount() {
    return this.nodes.reduce((sum, n) => sum + this.letterCount(n.gate), 0);
  }

  loadBookContent(gateNum, patch) {
    // Kept separate from addWord() on purpose — this is for coarser tags
    // (e.g. AutoLing-induced rules), not the real word/dependency graph.
    const node = this.nodes.find((n) => n.gate === gateNum);
    if (!node) throw new Error(`Gate ${gateNum} not found in ${this.name} layer`);
    if (patch.rules) node.content.rules.push(...patch.rules);
    return node;
  }
}

export class StateSpace {
  constructor(gateTable) {
    if (!Array.isArray(gateTable) || gateTable.length !== 64) {
      throw new Error(
        'StateSpace requires the real 64-gate table (each {gate, binary:[6 bits], trigrams:{upper,lower}}). ' +
        'None is embedded in this module on purpose — see file header.'
      );
    }
    for (const g of gateTable) {
      if (!Array.isArray(g.binary) || g.binary.length !== 6) {
        throw new Error(`Gate ${g.gate}: binary must be a 6-element array of 0/1`);
      }
      if (!g.trigrams || !g.trigrams.upper || !g.trigrams.lower) {
        throw new Error(`Gate ${g.gate}: trigrams.upper/lower required`);
      }
    }
    this.dimensions = {};
    for (const [name, spec] of Object.entries(DIMENSIONS)) {
      this.dimensions[name] = new DimensionLayer(name, spec, gateTable);
    }
  }

  node(dimensionName, gateNum) {
    const layer = this.dimensions[dimensionName];
    if (!layer) throw new Error(`Unknown dimension: ${dimensionName}`);
    return layer.nodes.find((n) => n.gate === gateNum);
  }

  // Cross-dimension read for a single gate — "each one still goes across":
  // every gate has a real position/content slot in all 5 dimensions at once.
  address(gateNum) {
    const out = {};
    for (const name of Object.keys(this.dimensions)) {
      out[name] = this.node(name, gateNum);
    }
    return out;
  }

  // Real word/letter counts per dimension, side by side — this is the actual
  // "some will be longer than others, that's how you tell what's sufficient"
  // signal, computed from real content, not asserted.
  contentSummary() {
    const out = {};
    for (const [name, layer] of Object.entries(this.dimensions)) {
      out[name] = { words: layer.totalWordCount(), letters: layer.totalLetterCount() };
    }
    return out;
  }
}

// gate_relations.mjs
//
// The three real, already-verified gate-to-gate transforms this project has
// established (organism.html lines ~439-460, reused there as real weighted
// Cortex topology edges: inverse=-0.6/"opposite polarity", reverse=+0.5/
// "same lines flipped order", nuclear=+0.4/"embedded substructure").
// Formulas copied verbatim, not reinvented, to avoid introducing a new bit-
// order bug into math this project has already caught and fixed twice.
//
// NOTE on naming: organism.html's "inverse" (bitwise NOT of the 6-bit value)
// is mathematically IDENTICAL to what state_space_core.mjs calls "complement"
// (Space dimension's current default sequence). Same transform, two names in
// two files — flagged here rather than silently duplicated as a 4th distinct
// relation. Hatcher's own Yijing dataset calls this same relation "pang tong
// gua" / "opposite" — three names, one real transform.

export function buildRelationTables(gateTable) {
  const GATE_BINARY = {};
  const BINARY_TO_GATE = {};
  for (const g of gateTable) {
    const bin = g.binary.reduce((acc, bit, i) => acc | (bit << i), 0); // same LSB=line1 convention as state_space_core.mjs
    GATE_BINARY[g.gate] = bin;
    BINARY_TO_GATE[bin] = g.gate;
  }
  return { GATE_BINARY, BINARY_TO_GATE };
}

export function makeGateRelations(gateTable) {
  const { GATE_BINARY, BINARY_TO_GATE } = buildRelationTables(gateTable);

  function gateInverse(gate) {
    return BINARY_TO_GATE[(~GATE_BINARY[gate]) & 0b111111];
  }
  function gateReverse(gate) {
    const b = GATE_BINARY[gate];
    const bits = [5, 4, 3, 2, 1, 0].map((i) => (b >> i) & 1);
    let out = 0;
    for (let i = 0; i < 6; i++) out |= bits[i] << i;
    return BINARY_TO_GATE[out];
  }
  function gateNuclear(gate) {
    const b = GATE_BINARY[gate];
    const lines = [1, 2, 3, 4, 5, 6].map((n) => (b >> (6 - n)) & 1);
    const lowerBits = (lines[1] << 2) | (lines[2] << 1) | lines[3];
    const upperBits = (lines[2] << 2) | (lines[3] << 1) | lines[4];
    return BINARY_TO_GATE[(upperBits << 3) | lowerBits];
  }

  return { gateInverse, gateReverse, gateNuclear, GATE_BINARY, BINARY_TO_GATE };
}

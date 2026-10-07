export const FIVE_FIELDS = Object.freeze(['Movement','Evolution','Being','Design','Space']);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function completeFiveFieldState(input = {}, { primaryDimension = null, basisValue = 1 } = {}) {
  const out = Object.fromEntries(FIVE_FIELDS.map(field => [field, finite(input?.[field], 0)]));
  if (primaryDimension && FIVE_FIELDS.includes(primaryDimension) && !FIVE_FIELDS.some(field => Number(input?.[field]))) {
    out[primaryDimension] = finite(basisValue, 1);
  }
  return Object.freeze(out);
}

export function assertFiveFieldState(input, label = 'five-field state') {
  if (!input || typeof input !== 'object') throw new TypeError(`${label} must be an object`);
  const keys = Object.keys(input).sort();
  const expected = [...FIVE_FIELDS].sort();
  if (keys.length !== expected.length || expected.some((key, index) => keys[index] !== key)) {
    throw new TypeError(`${label} must contain exactly ${FIVE_FIELDS.join(', ')}`);
  }
  for (const field of FIVE_FIELDS) {
    if (!Number.isFinite(Number(input[field]))) throw new TypeError(`${label}.${field} must be finite`);
  }
  return true;
}

export function addFiveFieldStates(...states) {
  const out = Object.fromEntries(FIVE_FIELDS.map(field => [field, 0]));
  for (const state of states) {
    const complete = completeFiveFieldState(state || {});
    for (const field of FIVE_FIELDS) out[field] += complete[field];
  }
  return Object.freeze(out);
}

export function meanFiveFieldStates(states = []) {
  if (!states.length) return completeFiveFieldState();
  const total = addFiveFieldStates(...states);
  return Object.freeze(Object.fromEntries(FIVE_FIELDS.map(field => [field, total[field] / states.length])));
}

export function fiveFieldDistance(a, b) {
  const aa = completeFiveFieldState(a), bb = completeFiveFieldState(b);
  return Math.sqrt(FIVE_FIELDS.reduce((sum, field) => sum + ((aa[field] - bb[field]) ** 2), 0));
}

export function fiveFieldCoherence(input) {
  const state = completeFiveFieldState(input);
  const values = FIVE_FIELDS.map(field => state[field]);
  const mean = values.reduce((a,b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Object.freeze({ mean, variance, coherence: mean - Math.sqrt(variance) });
}

export function fieldsFromDimension(dimension, amount = 1) {
  if (!FIVE_FIELDS.includes(dimension)) throw new Error(`Unknown five-field dimension: ${dimension}`);
  return completeFiveFieldState({ [dimension]: amount });
}

export function fieldsFromCapabilities(capabilities = []) {
  const fields = { Movement:0, Evolution:0, Being:0, Design:0, Space:0 };
  const text = capabilities.map(String).join(' ').toLowerCase();
  const bump = (field, terms) => { for (const term of terms) if (text.includes(term)) fields[field] += 1; };
  bump('Movement', ['browser','navigate','movement','action','render','media','event','transition','research','input']);
  bump('Evolution', ['memory','learn','history','precedent','continuity','checkpoint','outcome','success','association']);
  bump('Being', ['runtime','agent','conversation','sacral','contact','user','state','expression']);
  bump('Design', ['code','tool','factory','grammar','structure','visual','scene','style','artifact','plan','compose']);
  bump('Space', ['mesh','address','dimension','route','workspace','file','relation','capability','surface']);
  if (!FIVE_FIELDS.some(field => fields[field] > 0)) fields.Being = 1;
  return completeFiveFieldState(fields);
}

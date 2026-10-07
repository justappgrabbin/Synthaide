import { FIVE_FIELDS, fieldsFromCapabilities, fiveFieldDistance } from '../core/five_field_state.mjs';

function tokens(value) {
  return [...new Set(String(value ?? '').toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,}/g) || [])];
}

function searchable(node) {
  return [
    node.id, node.kind, node.scale, node.dimension, node.gate, node.text,
    JSON.stringify(node.address || {}),
    JSON.stringify(node.source || {}),
    JSON.stringify(node.attributes || {}),
  ].join(' ').toLowerCase();
}

/**
 * Deterministic cue -> local mesh neighborhood recall.
 * It never fabricates a remembered fact: matched nodes are recorded sources;
 * ranking and reconstructed neighborhood are explicitly marked derived.
 */
export class ATORecall {
  constructor(mesh, ato = null) {
    if (!mesh?.neighborhood) throw new TypeError('ATORecall requires an EmergentMesh');
    this.mesh = mesh;
    this.ato = ato;
  }

  resolveCue(cue, { address = null, fields = null, kinds = null, maxSeeds = 5 } = {}) {
    const cueTokens = tokens(cue);
    const kindSet = kinds ? new Set(kinds) : null;
    const cueFields = fields || fieldsFromCapabilities(cueTokens);
    const candidates = [];

    for (const node of this.mesh.nodes.values()) {
      if (kindSet && !kindSet.has(node.kind)) continue;
      if (node.kind === 'gate' && !address?.gate && cueTokens.length) continue;
      const hay = searchable(node);
      const tokenHits = cueTokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      let addressHits = 0;
      if (address && typeof address === 'object') {
        for (const [key,value] of Object.entries(address)) {
          if (value !== null && value !== undefined && String(node.address?.[key] ?? '') === String(value)) addressHits += 1;
        }
      }
      const distance = node.fields ? fiveFieldDistance(cueFields, node.fields) : 99;
      const fieldScore = Number.isFinite(distance) ? 1 / (1 + distance) : 0;
      const score = (tokenHits * 4) + (addressHits * 8) + fieldScore;
      if (tokenHits || addressHits || (!cueTokens.length && fields)) {
        candidates.push({ node, score, tokenHits, addressHits, fieldDistance:distance });
      }
    }

    return candidates
      .sort((a,b) => b.score - a.score || String(a.node.id).localeCompare(String(b.node.id)))
      .slice(0, Math.max(1, Number(maxSeeds) || 5));
  }

  recall(cue, { address = null, fields = null, kinds = null, hops = 2, maxSeeds = 3, maxNodes = 64, hydrate = false } = {}) {
    const seeds = this.resolveCue(cue, { address, fields, kinds, maxSeeds });
    const nodeMap = new Map();
    const edgeMap = new Map();
    for (const seed of seeds) {
      const neighborhood = this.mesh.neighborhood(seed.node.id, { hops, maxNodes });
      for (const node of neighborhood.nodes) {
        const existing = nodeMap.get(node.id);
        if (!existing || node.depth < existing.depth) nodeMap.set(node.id, node);
      }
      for (const edge of neighborhood.edges) edgeMap.set(edge.id, edge);
      if (hydrate) this.mesh.setResidency(seed.node.id, 'hot');
    }

    const cueFields = fields || fieldsFromCapabilities(tokens(cue));
    return Object.freeze({
      cue:String(cue ?? ''),
      epistemicStatus:'derived',
      reconstruction:'mesh-neighborhood',
      cueFields:Object.freeze(Object.fromEntries(FIVE_FIELDS.map(field => [field, cueFields[field]]))),
      seeds:seeds.map(seed => ({ id:seed.node.id, kind:seed.node.kind, score:seed.score, tokenHits:seed.tokenHits, addressHits:seed.addressHits, fieldDistance:seed.fieldDistance })),
      nodes:[...nodeMap.values()],
      edges:[...edgeMap.values()],
      evidence:seeds.map(seed => seed.node.id),
    });
  }
}

export default ATORecall;

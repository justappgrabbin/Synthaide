import { StateSpace, DIMENSIONS } from '../core/state_space_core.mjs';
import { makeGateRelations } from '../core/gate_relations.mjs';
import { makeOrbitEngine } from '../core/orbit_engine.mjs';
import { proxyCandidates } from './proxy_edges.mjs';
import { CausalTrace } from './causal_trace.mjs';
import { FIVE_FIELDS, completeFiveFieldState, assertFiveFieldState, meanFiveFieldStates } from '../core/five_field_state.mjs';

const DIMENSION_NAMES = Object.keys(DIMENSIONS);
const RESIDENCY = new Set(['hot','warm','cold','external']);

function assertGate(gate) {
  if (!Number.isInteger(gate) || gate < 1 || gate > 64) {
    throw new Error(`Gate must be an integer 1..64, got ${gate}`);
  }
}

function assertDimension(dimension) {
  if (!DIMENSION_NAMES.includes(dimension)) {
    throw new Error(`Unknown dimension: ${dimension}. Known: ${DIMENSION_NAMES.join(', ')}`);
  }
}

export class EmergentMesh {
  constructor(gateTable) {
    this.gateTable = gateTable;
    this.stateSpace = new StateSpace(gateTable);
    this.relations = makeGateRelations(gateTable);
    this.orbits = makeOrbitEngine(gateTable);
    this.nodes = new Map();
    this.edges = new Map();
    this.trace = new CausalTrace();
    this.seq = 0;
    this.handledRuntimeEvents = new Set();
    this.lastMovementNodeId = null;

    this._seedStructuralGateNodes();
  }

  _seedStructuralGateNodes() {
    for (const dimension of DIMENSION_NAMES) {
      for (let gate = 1; gate <= 64; gate++) {
        const source = this.stateSpace.node(dimension, gate);
        const id = `gate:${dimension}:${gate}`;
        this.nodes.set(id, {
          id,
          kind: 'gate',
          scale: 'structural',
          dimension,
          gate,
          text: null,
          fields: this.fieldPresence(dimension),
          address: { dimension, gate },
          source: null,
          attributes: {
            binary: [...source.binary],
            trigrams: { ...source.trigrams },
            layerRole: this.stateSpace.dimensions[dimension].layerRole,
            sequence: this.stateSpace.dimensions[dimension].sequenceName,
          },
          provenance: [],
        });
      }
    }

    // Structural transforms are explicit verified relations, not learned claims.
    for (let gate = 1; gate <= 64; gate++) {
      for (const [type, fn, weight] of [
        ['inverse', this.relations.gateInverse, -0.6],
        ['reverse', this.relations.gateReverse, 0.5],
        ['nuclear', this.relations.gateNuclear, 0.4],
      ]) {
        for (const dimension of DIMENSION_NAMES) {
          this.addEdge({
            from: `gate:${dimension}:${gate}`,
            to: `gate:${dimension}:${fn(gate)}`,
            type,
            status: 'structural',
            weight,
            evidence: ['verified-gate-transform'],
            dedupe: true,
          });
        }
      }
    }
  }

  fieldPresence(dimension) {
    assertDimension(dimension);
    return completeFiveFieldState({ [dimension]: 1 });
  }

  fiveFieldState(fields = {}, primaryDimension = null) {
    return completeFiveFieldState(fields, { primaryDimension });
  }

  node(id) {
    return this.nodes.get(id) || null;
  }

  edgesFor(nodeId) {
    return [...this.edges.values()].filter((e) => e.from === nodeId || e.to === nodeId);
  }

  addEdge({ from, to, type, status = 'canonical', weight = 1, score = null, reasons = [], evidence = [], dedupe = false }) {
    if (!this.nodes.has(from)) throw new Error(`Edge source does not exist: ${from}`);
    if (!this.nodes.has(to)) throw new Error(`Edge target does not exist: ${to}`);
    const key = `${type}|${status}|${from}|${to}`;
    if (dedupe && this.edges.has(key)) return this.edges.get(key);
    const edge = { id: key, from, to, type, status, weight, score, reasons: [...reasons], evidence: [...evidence] };
    this.edges.set(key, edge);
    return edge;
  }

  addKnowledge(record, { createProxyEdges = true } = {}) {
    const {
      id = `knowledge:${++this.seq}`,
      dimension,
      gate,
      text,
      scale = 'semantic',
      source = {},
      attributes = {},
      provenance = [],
      fields = null,
      residency = 'warm',
    } = record;

    assertDimension(dimension);
    assertGate(gate);
    if (!String(text || '').trim()) throw new Error('Knowledge node requires non-empty text');
    if (this.nodes.has(id)) throw new Error(`Node already exists: ${id}`);

    const node = {
      id,
      kind: 'knowledge',
      scale,
      dimension,
      gate,
      text: String(text).trim(),
      fields: fields ? completeFiveFieldState(fields, { primaryDimension: dimension }) : this.fieldPresence(dimension),
      address: { dimension, gate },
      source: { ...source },
      attributes: { residency: RESIDENCY.has(residency) ? residency : 'warm', ...attributes },
      provenance: [...provenance],
    };

    const existingKnowledge = [...this.nodes.values()].filter((n) => n.kind === 'knowledge');
    this.nodes.set(id, node);

    this.addEdge({
      from: id,
      to: `gate:${dimension}:${gate}`,
      type: 'located-at',
      status: 'canonical',
      evidence: provenance,
      dedupe: true,
    });

    const event = this.trace.record({
      type: 'knowledge-added',
      output: id,
      rule: 'ingest.explicit-address',
      evidence: provenance,
      meta: { dimension, gate },
    });

    if (createProxyEdges) {
      for (const candidate of proxyCandidates(node, existingKnowledge)) {
        this.addEdge({ ...candidate, evidence: [event.id], dedupe: true });
      }
    }

    return node;
  }

  addDependency(fromId, toId, { relation = 'depends-on', evidence = [] } = {}) {
    const edge = this.addEdge({
      from: fromId,
      to: toId,
      type: relation,
      status: 'canonical',
      evidence,
      dedupe: true,
    });
    this.trace.record({
      type: 'dependency-added',
      output: edge.id,
      rule: 'dependency.explicit',
      evidence,
      meta: { fromId, toId, relation },
    });
    return edge;
  }

  promoteProxy(edgeId, { type = 'related', evidence = [] } = {}) {
    const edge = this.edges.get(edgeId);
    if (!edge || edge.status !== 'candidate') throw new Error(`Candidate proxy edge not found: ${edgeId}`);
    this.edges.delete(edgeId);
    const promoted = this.addEdge({
      from: edge.from,
      to: edge.to,
      type,
      status: 'canonical',
      score: edge.score,
      reasons: edge.reasons,
      evidence: [...edge.evidence, ...evidence],
      dedupe: true,
    });
    this.trace.record({
      type: 'proxy-promoted',
      output: promoted.id,
      rule: 'edge.promote',
      evidence,
      meta: { from: edge.from, to: edge.to, previous: edgeId },
    });
    return promoted;
  }


  ingestMovementEvent(event) {
    if (!event?.id || !String(event.type || '').startsWith('movement-')) return null;
    if (this.handledRuntimeEvents.has(event.id)) return this.nodes.get(`motion:${event.id}`) || null;
    const payload = event.payload || {};
    const fieldByType = {
      'movement-planned': { Movement: 1, Evolution: 0, Being: 0, Design: 1, Space: 1 },
      'movement-step': { Movement: 1, Evolution: 0, Being: 0, Design: 0, Space: 0 },
      'movement-arrived': { Movement: 0, Evolution: 1, Being: 1, Design: 0, Space: 1 },
      'movement-interact': { Movement: 0, Evolution: 0, Being: 1, Design: 0, Space: 0 },
      'movement-finished': { Movement: 0, Evolution: 1, Being: 0, Design: 0, Space: 0 },
    };
    const fields = fieldByType[event.type] || { Movement: 0, Evolution: 0, Being: 1, Design: 0, Space: 0 };
    const id = `motion:${event.id}`;
    const node = {
      id,
      kind: 'embodiment',
      scale: 'runtime',
      dimension: null,
      gate: null,
      text: event.type,
      fields: { ...fields },
      address: {
        world: true,
        from: payload.from || null,
        to: payload.to || payload.location || null,
        transitionId: payload.transitionId || null,
        step: Number.isFinite(payload.step) ? payload.step : null,
      },
      source: { type: 'agent-runtime', eventId: event.id, at: event.at || null },
      attributes: {
        intent: payload.intent || null,
        frame: payload.frame || null,
        progress: Number.isFinite(payload.progress) ? payload.progress : null,
        facing: payload.facing || null,
      },
      provenance: [event.id],
    };
    this.nodes.set(id, node);
    if (this.lastMovementNodeId && this.nodes.has(this.lastMovementNodeId)) {
      this.addEdge({
        from: this.lastMovementNodeId,
        to: id,
        type: 'next-movement-state',
        status: 'runtime',
        evidence: [event.id],
        dedupe: true,
      });
    }
    this.lastMovementNodeId = id;
    this.handledRuntimeEvents.add(event.id);
    this.trace.record({
      type: 'embodiment-state-added',
      output: id,
      rule: `movement.${event.type.replace('movement-', '')}`,
      evidence: [event.id],
      meta: { fields, address: node.address },
    });
    return node;
  }

  ingestAgentHistory(history = []) {
    let added = 0;
    for (const event of history) {
      const before = this.handledRuntimeEvents.size;
      this.ingestMovementEvent(event);
      if (this.handledRuntimeEvents.size > before) added += 1;
    }
    return added;
  }


  addState(record = {}) {
    const {
      id = `state:${++this.seq}`, kind = 'state', scale = 'runtime', text = null,
      dimension = null, gate = null, fields = {}, address = {}, source = {},
      attributes = {}, provenance = [], residency = 'hot',
    } = record;
    if (this.nodes.has(id)) throw new Error(`Node already exists: ${id}`);
    if (dimension !== null) assertDimension(dimension);
    if (gate !== null) assertGate(gate);
    const five = completeFiveFieldState(fields, { primaryDimension: dimension });
    assertFiveFieldState(five);
    const node = {
      id, kind, scale, dimension, gate, text: text == null ? null : String(text),
      fields: five,
      address: { ...(dimension ? { dimension } : {}), ...(gate ? { gate } : {}), ...address },
      source: { ...source },
      attributes: { residency: RESIDENCY.has(residency) ? residency : 'hot', ...attributes },
      provenance: [...provenance],
    };
    this.nodes.set(id, node);
    if (dimension && gate) {
      this.addEdge({ from:id, to:`gate:${dimension}:${gate}`, type:'located-at', status:'canonical', evidence:provenance, dedupe:true });
    }
    this.trace.record({
      type:'five-field-state-added', output:id, rule:'mesh.state.explicit-five-field', evidence:provenance,
      meta:{ kind, fields:five, address:node.address, residency:node.attributes.residency },
    });
    return node;
  }

  addTransition(fromId, toId, { operator = 'transition', status = 'runtime', evidence = [], attributes = {} } = {}) {
    const edge = this.addEdge({ from:fromId, to:toId, type:operator, status, evidence, dedupe:false });
    edge.attributes = { ...attributes };
    this.trace.record({
      type:'five-field-transition', output:edge.id, rule:`mesh.transition.${operator}`, evidence,
      meta:{ from:fromId, to:toId, operator },
    });
    return edge;
  }

  setResidency(nodeId, residency) {
    if (!RESIDENCY.has(residency)) throw new Error(`Unknown residency: ${residency}`);
    const node=this.node(nodeId);
    if (!node) throw new Error(`Unknown node: ${nodeId}`);
    node.attributes = { ...(node.attributes || {}), residency };
    this.trace.record({ type:'residency-changed', output:nodeId, rule:'mesh.residency', meta:{ residency } });
    return node;
  }

  neighborhood(seedId, { hops = 1, maxNodes = 64, statuses = null, types = null } = {}) {
    if (!this.nodes.has(seedId)) throw new Error(`Unknown seed node: ${seedId}`);
    const allowedStatuses = statuses ? new Set(statuses) : null;
    const allowedTypes = types ? new Set(types) : null;
    const visited = new Map([[seedId,0]]);
    let frontier=[seedId];
    for (let depth=1; depth<=Math.max(0,Number(hops)||0) && frontier.length; depth++) {
      const next=[];
      for (const id of frontier) {
        for (const edge of this.edgesFor(id)) {
          if (allowedStatuses && !allowedStatuses.has(edge.status)) continue;
          if (allowedTypes && !allowedTypes.has(edge.type)) continue;
          const other=edge.from===id?edge.to:edge.from;
          if (!visited.has(other)) { visited.set(other,depth); next.push(other); if (visited.size>=maxNodes) break; }
        }
        if (visited.size>=maxNodes) break;
      }
      frontier=next;
      if (visited.size>=maxNodes) break;
    }
    return Object.freeze({
      seedId,
      nodes:[...visited].map(([id,depth])=>({ ...this.nodes.get(id), depth })),
      edges:[...this.edges.values()].filter(edge=>visited.has(edge.from)&&visited.has(edge.to)),
    });
  }

  recordGist({ id = `gist:${++this.seq}`, sourceIds = [], text = '', address = {}, provenance = [], residency = 'warm', attributes = {} } = {}) {
    const sources=sourceIds.map(sourceId=>this.node(sourceId)).filter(Boolean);
    if (!sources.length) throw new Error('Memory gist requires at least one existing source node');
    const fields=meanFiveFieldStates(sources.map(node=>node.fields));
    const node=this.addState({
      id, kind:'memory-gist', scale:'semantic', text, fields, address, provenance, residency,
      attributes:{ sourceCount:sources.length, epistemicStatus:'derived', ...attributes },
    });
    for (const source of sources) this.addEdge({ from:node.id, to:source.id, type:'summarizes', status:'derived', evidence:provenance, dedupe:true });
    return node;
  }

  orbit(startGate, direction, maxSteps = 20) {
    assertGate(startGate);
    return this.orbits.orbit(startGate, direction, maxSteps);
  }

  summary() {
    const nodes = [...this.nodes.values()];
    const edges = [...this.edges.values()];
    return {
      nodeCount: nodes.length,
      knowledgeNodes: nodes.filter((n) => n.kind === 'knowledge').length,
      embodimentNodes: nodes.filter((n) => n.kind === 'embodiment').length,
      structuralGateNodes: nodes.filter((n) => n.kind === 'gate').length,
      edgeCount: edges.length,
      canonicalEdges: edges.filter((e) => e.status === 'canonical').length,
      structuralEdges: edges.filter((e) => e.status === 'structural').length,
      candidateEdges: edges.filter((e) => e.status === 'candidate').length,
      runtimeEdges: edges.filter((e) => e.status === 'runtime').length,
      fiveFieldStates: nodes.filter((n) => n.fields && FIVE_FIELDS.every(field => Object.prototype.hasOwnProperty.call(n.fields, field))).length,
      residency: Object.fromEntries(['hot','warm','cold','external'].map(r => [r, nodes.filter(n => n.attributes?.residency === r).length])),
      dimensions: Object.fromEntries(DIMENSION_NAMES.map((name) => [
        name,
        nodes.filter((n) => n.dimension === name && n.kind === 'knowledge').length,
      ])),
    };
  }

  exportJSON() {
    return {
      version: 2,
      dimensions: DIMENSIONS,
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      trace: this.trace.events,
    };
  }
}

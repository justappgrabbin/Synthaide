/**
 * Synthia Five-Substrate Linguistic Kernel
 *
 * One linguistic state:
 *   L = { x, r, c, h }
 *
 * Five simultaneous projections over the SAME snapshot:
 *   Movement:  μ(L, a)  -> candidate transformation
 *   Evolution: e(L, H)  -> historical / sequence signal
 *   Being:     b(L, C)  -> resolved identity / meaning
 *   Design:    d(L, G)  -> validity / grammatical constraints
 *   Space:     s(Li,Lj) -> relational / perspective meaning
 *
 * Resolution:
 *   L[t+1] = F(L[t]; μ,e,b,d,s)
 *
 * No substrate directly mutates another substrate's output.
 * All projections are computed from an immutable snapshot, then resolved once.
 */

const clone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const deepFreeze = (obj) => {
  if (!obj || typeof obj !== "object" || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj)) deepFreeze(value);
  return obj;
};

const stableStringify = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
};

const hash32 = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

export class SynthiaLinguisticKernel {
  constructor(options = {}) {
    this.rewrites = new Map();
    this.constraints = [];
    this.interpreters = [];
    this.relationRules = [];
    this.maxHistory = options.maxHistory ?? 256;
    this.strictDesign = options.strictDesign ?? true;
  }

  /* ---------------------- registration ---------------------- */

  registerRewrite(name, predicate, transform, priority = 0) {
    if (this.rewrites.has(name)) throw new Error(`Rewrite already exists: ${name}`);
    this.rewrites.set(name, { name, predicate, transform, priority });
    return this;
  }

  registerConstraint(name, test, weight = 1) {
    this.constraints.push({ name, test, weight });
    return this;
  }

  registerInterpreter(name, interpret, priority = 0) {
    this.interpreters.push({ name, interpret, priority });
    return this;
  }

  registerRelation(name, relate, priority = 0) {
    this.relationRules.push({ name, relate, priority });
    return this;
  }

  /* ---------------------- state ---------------------- */

  createState({ x = null, r = {}, c = {}, h = [] } = {}) {
    return {
      x: clone(x),
      r: clone(r),
      c: clone(c),
      h: clone(h)
    };
  }

  /* ---------------------- five projections ---------------------- */

  // Movement: x[t+1] = f(x[t], o[t])
  movement(L, action = {}) {
    const candidates = [...this.rewrites.values()]
      .filter(rule => rule.predicate(L, action))
      .sort((a, b) =>
        b.priority - a.priority || a.name.localeCompare(b.name)
      );

    if (candidates.length === 0) {
      return {
        substrate: "Movement",
        operator: null,
        changed: false,
        xPrime: clone(L.x),
        trace: []
      };
    }

    const chosen = candidates[0];
    const xPrime = chosen.transform(clone(L.x), action, L);

    return {
      substrate: "Movement",
      operator: chosen.name,
      changed: stableStringify(xPrime) !== stableStringify(L.x),
      xPrime: clone(xPrime),
      trace: candidates.map(c => c.name)
    };
  }

  // Evolution: derives sequence/history signal from H[t] without random choice.
  evolution(L, action = {}) {
    const prior = L.h ?? [];
    const last = prior.length ? prior[prior.length - 1] : null;

    const sequence = prior.map(item => item.eventId).filter(Boolean);
    const inheritance = {
      priorEventId: last?.eventId ?? null,
      sequenceDepth: prior.length,
      actionType: action.type ?? null
    };

    return {
      substrate: "Evolution",
      sequence,
      inheritance,
      historyDepth: prior.length
    };
  }

  // Being: m[x,c*] = Φ(x | c*) ; once context is fixed, interpretation is fixed.
  being(L) {
    const ordered = [...this.interpreters]
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

    const readings = [];
    for (const rule of ordered) {
      const result = rule.interpret(L.x, L.c, L);
      if (result !== undefined && result !== null) {
        readings.push({ interpreter: rule.name, value: clone(result) });
      }
    }

    const resolved = readings.length
      ? readings[0].value
      : { identity: clone(L.x), context: clone(L.c) };

    return {
      substrate: "Being",
      contextFixed: true,
      meaning: resolved,
      readings
    };
  }

  // Design: V(x) = ∧ c_i(x), with weighted violation cost.
  design(L, xCandidate) {
    const results = this.constraints.map(rule => {
      const verdict = rule.test(xCandidate, L.c, L);
      const passed = verdict === true || verdict?.passed === true;
      const detail =
        typeof verdict === "object" && verdict !== null ? clone(verdict) : null;

      return {
        constraint: rule.name,
        passed,
        weight: rule.weight,
        cost: passed ? 0 : rule.weight,
        detail
      };
    });

    const cost = results.reduce((sum, r) => sum + r.cost, 0);
    const valid = results.every(r => r.passed);

    return {
      substrate: "Design",
      valid,
      cost,
      constraints: results
    };
  }

  // Space: R_ij = S(L_i, L_j, C), perspective-aware.
  space(L, event = {}) {
    const other = event.otherState
      ? this.createState(event.otherState)
      : null;

    const perspective = event.perspective ?? L.c?.perspective ?? "self";
    const ordered = [...this.relationRules]
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

    const relations = [];
    for (const rule of ordered) {
      const result = rule.relate(L, other, perspective, event);
      if (result !== undefined && result !== null) {
        relations.push({ relation: rule.name, value: clone(result) });
      }
    }

    return {
      substrate: "Space",
      perspective,
      otherPresent: Boolean(other),
      relations,
      resolvedRelation: relations.length
        ? relations[0].value
        : clone(L.r)
    };
  }

  /* ---------------------- simultaneous event ---------------------- */

  project(state, event = {}) {
    const snapshot = deepFreeze(this.createState(state));
    const action = clone(event.action ?? event);

    // Important: every projection receives the SAME immutable L[t].
    const mu = this.movement(snapshot, action);
    const e  = this.evolution(snapshot, action);
    const b  = this.being(snapshot);
    const d  = this.design(snapshot, mu.xPrime);
    const s  = this.space(snapshot, event);

    return deepFreeze({ mu, e, b, d, s });
  }

  resolve(state, event = {}, projections = null) {
    const L = this.createState(state);
    const P = projections ?? this.project(L, event);

    // Design gates the Movement candidate; it does not generate the candidate.
    const acceptMovement = P.d.valid || !this.strictDesign;
    const nextX = acceptMovement ? clone(P.mu.xPrime) : clone(L.x);

    const nextR = {
      ...clone(L.r),
      perspective: P.s.perspective,
      resolved: clone(P.s.resolvedRelation)
    };

    const nextC = {
      ...clone(L.c),
      meaning: clone(P.b.meaning)
    };

    const eventRecordCore = {
      action: clone(event.action ?? event),
      movement: {
        operator: P.mu.operator,
        changed: P.mu.changed,
        accepted: acceptMovement
      },
      evolution: clone(P.e.inheritance),
      being: clone(P.b.meaning),
      design: {
        valid: P.d.valid,
        cost: P.d.cost
      },
      space: {
        perspective: P.s.perspective,
        relation: clone(P.s.resolvedRelation)
      }
    };

    const eventId = `ling-${hash32(stableStringify(eventRecordCore))}`;
    const record = { eventId, ...eventRecordCore };

    const nextH = [...(L.h ?? []), record].slice(-this.maxHistory);

    return {
      x: nextX,
      r: nextR,
      c: nextC,
      h: nextH
    };
  }

  step(state, event = {}) {
    const projections = this.project(state, event);
    const nextState = this.resolve(state, event, projections);

    return {
      state: nextState,
      projections,
      eventId: nextState.h[nextState.h.length - 1]?.eventId ?? null
    };
  }

  replay(initialState, events = []) {
    let current = this.createState(initialState);
    const trace = [];

    for (const event of events) {
      const result = this.step(current, event);
      current = result.state;
      trace.push({
        eventId: result.eventId,
        projections: result.projections
      });
    }

    return { state: current, trace };
  }
}

/* ------------------------------------------------------------------
   Minimal Synthia defaults.
   Replace/extend these with the project's canonical grammar rules.
------------------------------------------------------------------- */

export function createDefaultSynthiaGrammar(options = {}) {
  const kernel = new SynthiaLinguisticKernel(options);

  kernel
    // MOVEMENT
    .registerRewrite(
      "replace-token",
      (_L, a) => a?.type === "replace-token" && Number.isInteger(a.index),
      (x, a) => {
        if (!Array.isArray(x)) return x;
        const next = [...x];
        if (a.index >= 0 && a.index < next.length) next[a.index] = a.value;
        return next;
      },
      100
    )
    .registerRewrite(
      "append-token",
      (_L, a) => a?.type === "append-token",
      (x, a) => Array.isArray(x) ? [...x, a.value] : [x, a.value],
      50
    )

    // DESIGN
    .registerConstraint(
      "no-empty-token",
      (x) => !Array.isArray(x) || x.every(token => token !== "" && token !== null),
      10
    )
    .registerConstraint(
      "bounded-length",
      (x, c) => !Array.isArray(x) || x.length <= (c.maxTokens ?? 256),
      5
    )

    // BEING
    .registerInterpreter(
      "contextual-token-identity",
      (x, c) => ({
        form: clone(x),
        role: c.role ?? "unresolved-role",
        domain: c.domain ?? "general",
        perspective: c.perspective ?? "self"
      }),
      10
    )

    // SPACE
    .registerRelation(
      "recipient-aware",
      (self, other, perspective, event) => ({
        speaker: self.c?.speaker ?? "self",
        receiver: other?.c?.speaker ?? event.receiver ?? "unknown",
        perspective,
        relationType: event.relationType ?? self.r?.type ?? "unspecified"
      }),
      10
    );

  return kernel;
}

export default createDefaultSynthiaGrammar;

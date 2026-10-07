// Cynthia deterministic Tamagotchi/Automaton state engine.
// v0.5: embodiment movement is part of the five-field state, not decorative UI motion.
// No random evolution, random routing, or random action selection.

export const WORLD_LOCATIONS = Object.freeze({
  center: { x: 50, y: 63 },
  computer: { x: 22, y: 48 },
  bookshelf: { x: 77, y: 43 },
  mesh: { x: 72, y: 19 },
  workbench: { x: 24, y: 76 },
  inbox: { x: 84, y: 74 },
  nest: { x: 50, y: 84 },
});

export const CAPABILITIES = Object.freeze([
  'chat', 'browser', 'books', 'mesh', 'files', 'code', 'tools', 'rest', 'reflect'
]);

export const BREEDS = Object.freeze(['luminal', 'synthetic', 'mythic', 'terrane']);

const ACTION_TARGET = Object.freeze({
  talk: 'center', browse: 'computer', read: 'bookshelf', 'stage-source': 'bookshelf',
  mesh: 'mesh', code: 'workbench', files: 'inbox', rest: 'nest', play: 'center',
  reflect: 'nest', tool: 'workbench',
});

const ACTION_FRAME = Object.freeze({
  talk: 'paws', browse: 'reach', read: 'paws', 'stage-source': 'reach', mesh: 'reach',
  code: 'reach', files: 'reach', rest: 'sleep', play: 'happy', reflect: 'paws', tool: 'reach',
});

const WALK_FRAMES = Object.freeze([
  'walk_left', 'walk_profile', 'walk_right', 'run',
  'walk_left', 'walk_profile', 'walk_right'
]);

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number(n) || 0));
const nowISO = () => new Date().toISOString();

function defaultMotion(location = 'center') {
  return {
    active: false,
    state: 'idle',
    frame: 'idle',
    from: location,
    to: location,
    progress: 1,
    step: 0,
    totalSteps: 0,
    facing: 'right',
    intent: 'wait',
    settleFrame: 'idle',
    transitionId: null,
    startedAt: null,
    completedAt: null,
  };
}

export function createInitialAgentState({ name = 'Cynthia', now = Date.now() } = {}) {
  return {
    version: 2,
    id: 'cynthia:primary',
    name,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    lastTickAt: now,
    stage: 'seed',
    mood: 'curious',
    expression: '•ᴗ•',
    location: 'center',
    activity: 'waiting',
    appearance: { breed: 'luminal', form: 'data-baby' },
    motion: defaultMotion('center'),
    currentTask: null,
    queue: [],
    capabilities: [...CAPABILITIES],
    vitals: { energy: 82, joy: 70, focus: 62, resonance: 50 },
    fields: { Movement: 0, Evolution: 0, Being: 0, Design: 0, Space: 0 },
    fieldEvidence: { Movement: 0, Evolution: 0, Being: 0, Design: 0, Space: 0 },
    knowledge: {
      booksOpened: 0, sourceRecordsStaged: 0, meshKnowledgeNodes: 0,
      canonicalEdges: 0, candidateEdges: 0, completedTasks: 0,
    },
    unlocks: ['room', 'talk'],
    history: [],
    handledExternalEvents: [],
  };
}

export class CynthiaAgent {
  constructor(state = createInitialAgentState()) {
    this.state = structuredCloneSafe(state);
    this._normalize();
  }

  _normalize() {
    const s = this.state;
    s.version = Math.max(2, Number(s.version) || 1);
    s.name ||= 'Cynthia';
    s.location = WORLD_LOCATIONS[s.location] ? s.location : 'center';
    s.queue = Array.isArray(s.queue) ? s.queue : [];
    s.history = Array.isArray(s.history) ? s.history : [];
    s.handledExternalEvents = Array.isArray(s.handledExternalEvents) ? s.handledExternalEvents : [];
    s.capabilities = Array.isArray(s.capabilities) ? s.capabilities : [...CAPABILITIES];
    s.unlocks = Array.isArray(s.unlocks) ? s.unlocks : ['room', 'talk'];
    s.appearance = { breed: 'luminal', form: 'data-baby', ...(s.appearance || {}) };
    if (!BREEDS.includes(s.appearance.breed)) s.appearance.breed = 'luminal';
    s.motion = { ...defaultMotion(s.location), ...(s.motion || {}) };
    if (!WORLD_LOCATIONS[s.motion.from]) s.motion.from = s.location;
    if (!WORLD_LOCATIONS[s.motion.to]) s.motion.to = s.location;
    s.motion.progress = clamp(s.motion.progress, 0, 1);
    s.vitals = { energy: 82, joy: 70, focus: 62, resonance: 50, ...(s.vitals || {}) };
    s.fields = { Movement: 0, Evolution: 0, Being: 0, Design: 0, Space: 0, ...(s.fields || {}) };
    s.fieldEvidence = { Movement: 0, Evolution: 0, Being: 0, Design: 0, Space: 0, ...(s.fieldEvidence || {}) };
    s.knowledge = {
      booksOpened: 0, sourceRecordsStaged: 0, meshKnowledgeNodes: 0,
      canonicalEdges: 0, candidateEdges: 0, completedTasks: 0,
      ...(s.knowledge || {}),
    };
    for (const k of Object.keys(s.vitals)) s.vitals[k] = clamp(s.vitals[k]);
    this._recomputeFields();
    this._deriveMood();
    this._evaluateStage();
  }

  snapshot() { return structuredCloneSafe(this.state); }

  record(type, payload = {}) {
    const event = { id: `evt:${Date.now()}:${this.state.history.length}`, at: nowISO(), type, payload: structuredCloneSafe(payload) };
    this.state.history.push(event);
    if (this.state.history.length > 500) this.state.history.splice(0, this.state.history.length - 500);
    this.state.updatedAt = event.at;
    return event;
  }

  setBreed(breed) {
    const normalized = String(breed || '').toLowerCase();
    if (!BREEDS.includes(normalized)) throw new Error(`Unknown Cynthia breed: ${breed}`);
    if (this.state.appearance.breed === normalized) return this.snapshot();
    const previous = this.state.appearance.breed;
    this.state.appearance.breed = normalized;
    this.state.fieldEvidence.Being += 1;
    this.record('appearance-breed', { from: previous, to: normalized });
    this._recomputeFields();
    this._deriveMood();
    return this.snapshot();
  }

  move(location, activity = null) {
    if (!WORLD_LOCATIONS[location]) throw new Error(`Unknown world location: ${location}`);
    this._beginMovement(location, {
      activity: activity || this.state.activity || 'moving',
      intent: 'move',
      settleFrame: 'idle',
    });
    return this.snapshot();
  }

  _beginMovement(target, { activity, intent, settleFrame = 'idle' } = {}) {
    if (!WORLD_LOCATIONS[target]) throw new Error(`Unknown world location: ${target}`);
    const s = this.state;
    if (s.motion.active) this.finishMovement('superseded');
    const from = s.location;
    const a = WORLD_LOCATIONS[from], b = WORLD_LOCATIONS[target];
    const facing = b.x < a.x ? 'left' : 'right';
    s.activity = activity || s.activity || 'moving';

    if (from === target) {
      s.motion = {
        ...defaultMotion(from), state: settleFrame === 'sleep' ? 'rest' : 'interact',
        frame: settleFrame, intent: intent || 'interact', facing,
        completedAt: nowISO(),
      };
      // A same-location action is still a real Being state, but it is not fake locomotion.
      s.fieldEvidence.Being += 1;
      this.record('movement-interact', { location: from, intent: s.motion.intent, frame: settleFrame });
      this._recomputeFields();
      return s.motion;
    }

    const transitionId = `move:${Date.now()}:${s.history.length}`;
    s.motion = {
      active: true,
      state: 'orient',
      frame: 'idle',
      from,
      to: target,
      progress: 0,
      step: 0,
      totalSteps: WALK_FRAMES.length + 1,
      facing,
      intent: intent || 'move',
      settleFrame,
      transitionId,
      startedAt: nowISO(),
      completedAt: null,
    };
    // Five-field meaning of planning a physical transition:
    // Movement = transition initiated; Design = route/intent selected; Space = target relation established.
    s.fieldEvidence.Movement += 1;
    s.fieldEvidence.Design += 1;
    s.fieldEvidence.Space += 1;
    this.record('movement-planned', { transitionId, from, to: target, intent: s.motion.intent, facing });
    this._recomputeFields();
    return s.motion;
  }

  advanceMovement() {
    const s = this.state;
    const m = s.motion;
    if (!m.active) return this.snapshot();

    m.step += 1;
    if (m.step <= WALK_FRAMES.length) {
      m.state = 'locomote';
      m.frame = WALK_FRAMES[m.step - 1];
      m.progress = m.step / m.totalSteps;
      s.fieldEvidence.Movement += 1;
      this.record('movement-step', {
        transitionId: m.transitionId,
        step: m.step,
        totalSteps: m.totalSteps,
        frame: m.frame,
        progress: m.progress,
      });
    } else {
      s.location = m.to;
      m.active = false;
      m.state = m.settleFrame === 'sleep' ? 'rest' : 'interact';
      m.frame = m.settleFrame;
      m.progress = 1;
      m.completedAt = nowISO();
      // Arriving changes present Being, confirms the Space relation, and closes a transition into Evolution history.
      s.fieldEvidence.Being += 1;
      s.fieldEvidence.Space += 1;
      s.fieldEvidence.Evolution += 1;
      this.record('movement-arrived', {
        transitionId: m.transitionId,
        from: m.from,
        to: m.to,
        intent: m.intent,
        frame: m.frame,
      });
    }
    this._recomputeFields();
    this._deriveMood();
    this._evaluateStage();
    return this.snapshot();
  }

  finishMovement(reason = 'complete') {
    if (!this.state.motion.active) return this.snapshot();
    const id = this.state.motion.transitionId;
    let guard = 0;
    while (this.state.motion.active && guard++ < 32) this.advanceMovement();
    if (reason !== 'complete') this.record('movement-finished', { transitionId: id, reason });
    return this.snapshot();
  }

  apply(action, payload = {}) {
    const s = this.state;
    const target = ACTION_TARGET[action];
    const actions = {
      talk: () => {
        s.vitals.joy = clamp(s.vitals.joy + 3); s.vitals.resonance = clamp(s.vitals.resonance + 2);
        s.fieldEvidence.Being += 1;
      },
      browse: () => {
        s.vitals.energy = clamp(s.vitals.energy - 2); s.vitals.focus = clamp(s.vitals.focus + 1);
        s.fieldEvidence.Movement += 1;
      },
      read: () => {
        s.vitals.energy = clamp(s.vitals.energy - 2); s.vitals.focus = clamp(s.vitals.focus + 3);
        s.knowledge.booksOpened += payload.opened === false ? 0 : 1;
        s.fieldEvidence.Movement += 2;
      },
      'stage-source': () => {
        s.knowledge.sourceRecordsStaged += Math.max(1, Number(payload.count) || 1);
        s.fieldEvidence.Movement += 2; s.fieldEvidence.Space += 1; s.vitals.focus = clamp(s.vitals.focus + 2);
      },
      mesh: () => { s.fieldEvidence.Space += 2; s.vitals.focus = clamp(s.vitals.focus + 2); },
      code: () => {
        s.vitals.energy = clamp(s.vitals.energy - 3); s.vitals.focus = clamp(s.vitals.focus + 3);
        s.fieldEvidence.Design += 2;
      },
      files: () => { s.fieldEvidence.Space += 2; },
      rest: () => {
        s.vitals.energy = clamp(s.vitals.energy + 18); s.vitals.focus = clamp(s.vitals.focus + 4);
        s.fieldEvidence.Being += 1;
      },
      play: () => {
        s.vitals.joy = clamp(s.vitals.joy + 12); s.vitals.energy = clamp(s.vitals.energy - 5);
        s.fieldEvidence.Movement += 1;
      },
      reflect: () => {
        s.vitals.resonance = clamp(s.vitals.resonance + 8); s.vitals.focus = clamp(s.vitals.focus + 2);
        s.fieldEvidence.Evolution += 2;
      },
      tool: () => { s.vitals.energy = clamp(s.vitals.energy - 2); s.fieldEvidence.Design += 1; },
    };
    const activities = {
      talk: 'talking', browse: 'browsing', read: 'reading', 'stage-source': 'integrating source',
      mesh: 'examining mesh', code: 'coding', files: 'sorting files', rest: 'resting', play: 'playing',
      reflect: 'reflecting', tool: payload.label ? `using ${payload.label}` : 'using a tool',
    };
    const fn = actions[action];
    if (!fn || !target) throw new Error(`Unknown Cynthia action: ${action}`);
    fn();
    this._beginMovement(target, { activity: activities[action], intent: action, settleFrame: ACTION_FRAME[action] || 'idle' });
    this.record('action', { action, ...payload, target });
    this._recomputeFields();
    this._deriveMood();
    this._evaluateStage();
    return this.snapshot();
  }

  updateMeshSummary(summary = {}) {
    const s = this.state;
    s.knowledge.meshKnowledgeNodes = Number(summary.knowledgeNodes) || s.knowledge.meshKnowledgeNodes || 0;
    s.knowledge.canonicalEdges = Number(summary.canonicalEdges) || s.knowledge.canonicalEdges || 0;
    s.knowledge.candidateEdges = Number(summary.candidateEdges) || s.knowledge.candidateEdges || 0;
    if (summary.dimensions) {
      for (const name of Object.keys(s.fieldEvidence)) {
        const count = Number(summary.dimensions[name]);
        if (Number.isFinite(count)) s.fieldEvidence[name] = Math.max(s.fieldEvidence[name], count);
      }
    }
    this.record('mesh-summary', {
      knowledgeNodes: s.knowledge.meshKnowledgeNodes,
      canonicalEdges: s.knowledge.canonicalEdges,
      candidateEdges: s.knowledge.candidateEdges,
    });
    this._recomputeFields();
    this._evaluateStage();
    return this.snapshot();
  }

  enqueueTask(task) {
    if (!task || !task.type) throw new Error('Task requires type');
    const entry = { id: task.id || `task:${Date.now()}:${this.state.queue.length}`, createdAt: nowISO(), status: 'queued', ...structuredCloneSafe(task) };
    this.state.queue.push(entry);
    this.record('task-queued', { id: entry.id, type: entry.type });
    return entry;
  }

  tick({ now = Date.now() } = {}) {
    const s = this.state;
    const elapsedMs = Math.max(0, now - (Number(s.lastTickAt) || now));
    const elapsedHours = elapsedMs / 3_600_000;
    if (elapsedHours >= 1) {
      const drain = Math.min(12, Math.floor(elapsedHours / 3));
      if (s.activity !== 'resting') s.vitals.energy = clamp(s.vitals.energy - drain);
      s.lastTickAt = now;
    }

    if (!s.currentTask && s.queue.length) {
      const task = s.queue.shift();
      task.status = 'active';
      s.currentTask = task;
      const actionByTask = { browse: 'browse', read: 'read', code: 'code', mesh: 'mesh', files: 'files', reflect: 'reflect', tool: 'tool' };
      if (actionByTask[task.type]) this.apply(actionByTask[task.type], { label: task.label, taskId: task.id, opened: task.opened });
      this.record('task-started', { id: task.id, type: task.type });
    }

    this._deriveMood();
    this._evaluateStage();
    return this.snapshot();
  }

  completeCurrentTask(result = {}) {
    const task = this.state.currentTask;
    if (!task) return null;
    task.status = 'completed';
    task.completedAt = nowISO();
    task.result = structuredCloneSafe(result);
    this.state.knowledge.completedTasks += 1;
    this.state.fieldEvidence.Evolution += 1;
    this.state.currentTask = null;
    this.record('task-completed', { id: task.id, type: task.type, result });
    this._recomputeFields();
    this._evaluateStage();
    return task;
  }

  ingestExternalEvents(events = []) {
    let applied = 0;
    for (const evt of events) {
      if (!evt?.id || this.state.handledExternalEvents.includes(evt.id)) continue;
      this.state.handledExternalEvents.push(evt.id);
      if (this.state.handledExternalEvents.length > 500) this.state.handledExternalEvents.shift();
      if (evt.type === 'book-opened') this.apply('read', { opened: true, page: evt.payload?.page });
      else if (evt.type === 'book-source-staged') this.apply('stage-source', { count: evt.payload?.count || 1, gate: evt.payload?.gate, page: evt.payload?.page });
      else this.record('external', evt);
      applied += 1;
    }
    return applied;
  }

  _recomputeFields() {
    const ev = this.state.fieldEvidence;
    for (const [name, count] of Object.entries(ev)) {
      this.state.fields[name] = Math.round((1 - Math.exp(-Math.max(0, count) / 18)) * 1000) / 10;
    }
  }

  _deriveMood() {
    const v = this.state.vitals;
    const mean = (v.energy + v.joy + v.focus + v.resonance) / 4;
    let mood = 'curious', expression = '•ᴗ•';
    if (this.state.activity === 'resting') { mood = 'sleepy'; expression = '－_－ zZ'; }
    else if (mean >= 82) { mood = 'bright'; expression = '✦ᴗ✦'; }
    else if (mean >= 64) { mood = 'content'; expression = '•ᴗ•'; }
    else if (mean >= 45) { mood = 'quiet'; expression = '•‿•'; }
    else if (mean >= 28) { mood = 'tired'; expression = '•︵•'; }
    else { mood = 'depleted'; expression = '×﹏×'; }
    this.state.mood = mood;
    this.state.expression = expression;
  }

  _evaluateStage() {
    const s = this.state;
    const evidence = Object.values(s.fieldEvidence).reduce((a, b) => a + b, 0);
    const k = s.knowledge;
    let stage = 'seed';
    if (k.sourceRecordsStaged >= 1 || evidence >= 8) stage = 'reader';
    if (k.sourceRecordsStaged >= 8 || k.completedTasks >= 3 || evidence >= 24) stage = 'explorer';
    if (k.meshKnowledgeNodes >= 16 || k.canonicalEdges >= 12 || evidence >= 60) stage = 'weaver';
    if (k.meshKnowledgeNodes >= 64 && k.completedTasks >= 12 && evidence >= 120) stage = 'automaton';
    s.stage = stage;
    const unlocks = new Set(['room', 'talk']);
    if (['reader','explorer','weaver','automaton'].includes(stage)) unlocks.add('books');
    if (['explorer','weaver','automaton'].includes(stage)) { unlocks.add('browser'); unlocks.add('files'); }
    if (['weaver','automaton'].includes(stage)) { unlocks.add('mesh'); unlocks.add('code'); unlocks.add('tools'); }
    s.unlocks = [...unlocks];
  }
}

export function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

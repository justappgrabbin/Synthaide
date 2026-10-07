import {
  TASK_STATUS,
  createTaskModel,
  advanceTaskModel,
  pickNextRunnable as pickRunnableModel,
} from '../core/task_continuity.mjs';
import { completeFiveFieldState } from '../core/five_field_state.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const safe = value => String(value ?? '').replace(/[^a-zA-Z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

function statusBeing(status) {
  if (status === TASK_STATUS.COMPLETED) return 2;
  if ([TASK_STATUS.ACTIVE, TASK_STATUS.BACKGROUND_ACTIVE].includes(status)) return 1.5;
  if ([TASK_STATUS.WARM_WAIT, TASK_STATUS.BLOCKED_WAITING_USER].includes(status)) return 1.25;
  if ([TASK_STATUS.BLOCKED_EXTERNAL, TASK_STATUS.BLOCKED_CAPABILITY].includes(status)) return 0.8;
  if ([TASK_STATUS.FAILED, TASK_STATUS.CANCELLED].includes(status)) return 0.4;
  return 1;
}

/**
 * A task is a trajectory through the same five-dimensional mesh as every other
 * Synthia state. These values are deterministic structural projections, not
 * probabilities and not a second task ontology.
 */
export function taskFiveFields(task) {
  const planLength = Math.max(1, task?.plan?.length || 0);
  const completed = Math.max(0, task?.completedSteps?.length || task?.currentStep || 0);
  const hasBlocker = task?.blocker ? 1 : 0;
  return completeFiveFieldState({
    Movement: 1 + completed,
    Evolution: 1 + completed + ((Number(task?.progress) || 0) / 100),
    Being: statusBeing(task?.status),
    Design: 1 + planLength,
    Space: 1 + hasBlocker + (task?.resumePoint?.step_key ? 0.5 : 0),
  });
}

export function stepFiveFields(step, index = 0, planLength = 1) {
  const executor = String(step?.executor || '').toLowerCase();
  const operation = String(step?.operation || '').toLowerCase();
  return completeFiveFieldState({
    Movement: 1 + (executor === 'server' || executor === 'browser' || executor === 'client' ? 1 : 0),
    Evolution: 1 + (operation === 'checkpoint' || operation === 'record' || operation === 'derive' ? 1 : 0),
    Being: 1 + (step?.requires_user || executor === 'user' ? 1 : 0),
    Design: 1 + ((index + 1) / Math.max(1, planLength)),
    Space: 1 + (executor === 'external' || operation === 'wait' ? 1 : 0),
  });
}

function taskRootId(taskId) { return `task:${safe(taskId)}`; }

export class MeshContinuity {
  constructor(mesh, { warmWaitSeconds = 600 } = {}) {
    if (!mesh?.addState || !mesh?.addTransition) throw new TypeError('MeshContinuity requires an EmergentMesh');
    this.mesh = mesh;
    this.defaultWarmWaitSeconds = Math.max(0, Number(warmWaitSeconds) || 600);
  }

  _taskRoots() {
    return [...this.mesh.nodes.values()].filter(node => node.kind === 'task' && node.attributes?.modelId);
  }

  _taskRoot(taskId) {
    const id = taskRootId(taskId);
    return this.mesh.node(id) || this._taskRoots().find(node => node.attributes?.modelId === taskId) || null;
  }

  _statesForRoot(root) {
    if (!root) return [];
    return this.mesh.edgesFor(root.id)
      .filter(edge => edge.from === root.id && edge.type === 'has-task-state')
      .map(edge => this.mesh.node(edge.to))
      .filter(node => node?.kind === 'task-state')
      .sort((a,b) => Number(a.attributes?.version || 0) - Number(b.attributes?.version || 0));
  }

  _latestState(root) {
    const states = this._statesForRoot(root);
    return states.at(-1) || null;
  }

  _model(taskId) {
    const root = this._taskRoot(taskId);
    if (!root) return null;
    const state = this._latestState(root);
    return state?.attributes?.model ? clone(state.attributes.model) : null;
  }

  _authorizedSteps(root) {
    const set = new Set();
    if (!root) return set;
    for (const edge of this.mesh.edgesFor(root.id)) {
      if (edge.from !== root.id || edge.type !== 'has-authorization') continue;
      const node = this.mesh.node(edge.to);
      if (node?.kind === 'authorization' && node.attributes?.status === 'authorized') {
        set.add(String(node.attributes.stepKey));
      }
    }
    return set;
  }

  _writeState(root, model, { cause = 'state-update', evidence = [], previous = null } = {}) {
    const version = (this._latestState(root)?.attributes?.version || 0) + 1;
    const id = `${root.id}:state:${version}`;
    const node = this.mesh.addState({
      id,
      kind: 'task-state',
      scale: 'runtime',
      text: `${model.title}: ${model.status}`,
      fields: taskFiveFields(model),
      address: { task: model.id, taskType: model.type, status: model.status, step: model.currentStep },
      source: { type: 'mesh-continuity', cause },
      provenance: evidence,
      residency: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED, TASK_STATUS.FAILED].includes(model.status) ? 'warm' : 'hot',
      attributes: {
        version,
        epistemicStatus: 'recorded',
        model: clone(model),
        blocker: clone(model.blocker),
        resumePoint: clone(model.resumePoint),
      },
    });
    this.mesh.addEdge({ from: root.id, to: node.id, type: 'has-task-state', status: 'canonical', evidence, dedupe: true });
    if (previous) this.mesh.addTransition(previous.id, node.id, { operator: cause, evidence });
    return node;
  }

  createTask({ id = `mesh-${Date.now()}-${this.mesh.seq + 1}`, title = 'Untitled task', type = 'general', plan = [], priority = 0, warmWaitSeconds = this.defaultWarmWaitSeconds, now = Date.now(), fields = null, address = {}, provenance = [] } = {}) {
    if (this._taskRoot(id)) throw new Error(`Task already exists in mesh: ${id}`);
    const model = createTaskModel({ id, title, type, plan, priority, warmWaitSeconds, now });
    const root = this.mesh.addState({
      id: taskRootId(id),
      kind: 'task',
      scale: 'system',
      text: title,
      fields: fields || taskFiveFields(model),
      address: { task: id, taskType: type, ...address },
      source: { type: 'mesh-continuity' },
      provenance,
      residency: 'hot',
      attributes: { modelId: id, title, taskType: type, priority, epistemicStatus: 'recorded' },
    });

    model.plan.forEach((step, index) => {
      const stepNode = this.mesh.addState({
        id: `${root.id}:step:${index}:${safe(step.key)}`,
        kind: 'task-step',
        scale: 'operation',
        text: step.label,
        fields: stepFiveFields(step, index, model.plan.length),
        address: { task: id, step: index, stepKey: step.key },
        source: { type: 'task-plan' },
        provenance,
        residency: 'warm',
        attributes: { index, step: clone(step), epistemicStatus: 'recorded' },
      });
      this.mesh.addEdge({ from: root.id, to: stepNode.id, type: 'has-step', status: 'canonical', evidence: provenance, dedupe: true });
      if (index > 0) {
        const prior = `${root.id}:step:${index-1}:${safe(model.plan[index-1].key)}`;
        this.mesh.addEdge({ from: prior, to: stepNode.id, type: 'next-step', status: 'canonical', evidence: provenance, dedupe: true });
      }
    });

    const state = this._writeState(root, model, { cause: 'task-created', evidence: provenance });
    this.mesh.addEdge({ from: root.id, to: state.id, type: 'begins-at', status: 'canonical', evidence: provenance, dedupe: true });
    return Object.freeze({ task: clone(model), root, state });
  }

  getTask(taskId) { return this._model(taskId); }

  listTasks({ statuses = null } = {}) {
    const allowed = statuses ? new Set(statuses) : null;
    return this._taskRoots().map(root => this._model(root.attributes.modelId)).filter(Boolean).filter(model => !allowed || allowed.has(model.status));
  }

  advance(taskId, { now = Date.now(), serverCapabilities = new Set(['prepare','derive','record','checkpoint']) } = {}) {
    const root = this._taskRoot(taskId);
    if (!root) throw new Error(`Task not found in mesh: ${taskId}`);
    const previous = this._latestState(root);
    const before = clone(previous.attributes.model);
    const authorizedSteps = this._authorizedSteps(root);
    const after = advanceTaskModel(before, { now, authorizedSteps, serverCapabilities });
    const state = this._writeState(root, after, { cause: 'task-advance', previous, evidence: [previous.id] });

    if (after.blocker?.type === 'user_authorization') {
      const stepKey = after.blocker.step_key;
      const existing = this.mesh.edgesFor(root.id)
        .filter(edge => edge.from === root.id && edge.type === 'has-authorization')
        .map(edge => this.mesh.node(edge.to))
        .find(node => node?.attributes?.stepKey === stepKey && node.attributes.status === 'pending');
      if (!existing) {
        const auth = this.mesh.addState({
          id: `${root.id}:authorization:${safe(stepKey)}:${state.attributes.version}`,
          kind: 'authorization',
          scale: 'operation',
          text: `Authorization required: ${stepKey}`,
          fields: completeFiveFieldState({ Movement:1, Evolution:1, Being:2, Design:1, Space:1 }),
          address: { task: taskId, stepKey, authorizationType: after.blocker.authorization_type || 'authorization' },
          source: { type: 'mesh-continuity' },
          provenance: [state.id],
          residency: 'hot',
          attributes: { taskId, stepKey, status: 'pending', authorizationType: after.blocker.authorization_type || 'authorization', epistemicStatus:'recorded' },
        });
        this.mesh.addEdge({ from: root.id, to: auth.id, type: 'has-authorization', status: 'canonical', evidence:[state.id], dedupe:true });
      }
    }
    return Object.freeze({ before, task: clone(after), state });
  }

  authorize(taskId, stepKey, { status = 'authorized', response = {}, now = Date.now(), provenance = [] } = {}) {
    if (!['authorized','denied'].includes(status)) throw new Error(`Unsupported authorization status: ${status}`);
    const root = this._taskRoot(taskId);
    if (!root) throw new Error(`Task not found in mesh: ${taskId}`);
    const id = `${root.id}:authorization:${safe(stepKey)}:${++this.mesh.seq}`;
    const node = this.mesh.addState({
      id, kind:'authorization', scale:'operation', text:`${status}: ${stepKey}`,
      fields: completeFiveFieldState({ Movement:1, Evolution:2, Being:2, Design:1, Space:1 }),
      address:{ task:taskId, stepKey }, source:{ type:'user-authorization', at:new Date(now).toISOString() },
      provenance, residency:'hot',
      attributes:{ taskId, stepKey:String(stepKey), status, response:clone(response), epistemicStatus:'recorded' },
    });
    this.mesh.addEdge({ from:root.id, to:node.id, type:'has-authorization', status:'canonical', evidence:provenance, dedupe:true });
    return node;
  }

  checkpoint(taskId, payload = {}, { now = Date.now(), provenance = [] } = {}) {
    const root = this._taskRoot(taskId);
    if (!root) throw new Error(`Task not found in mesh: ${taskId}`);
    const current = this._latestState(root);
    const model = clone(current.attributes.model);
    const checkpoint = this.mesh.addState({
      id:`${root.id}:checkpoint:${++this.mesh.seq}`,
      kind:'checkpoint', scale:'runtime', text:`Checkpoint: ${model.title}`,
      fields: taskFiveFields(model), address:{ task:taskId, step:model.currentStep },
      source:{ type:'mesh-continuity', at:new Date(now).toISOString() }, provenance:[current.id, ...provenance], residency:'warm',
      attributes:{ taskId, taskStateId:current.id, payload:clone(payload), model:clone(model), epistemicStatus:'recorded' },
    });
    this.mesh.addEdge({ from:root.id, to:checkpoint.id, type:'has-checkpoint', status:'canonical', evidence:[current.id, ...provenance], dedupe:true });
    this.mesh.addEdge({ from:checkpoint.id, to:current.id, type:'captures-state', status:'canonical', evidence:[current.id], dedupe:true });
    return checkpoint;
  }

  background(taskId) {
    const root = this._taskRoot(taskId);
    if (!root) throw new Error(`Task not found in mesh: ${taskId}`);
    this.mesh.setResidency(root.id, 'warm');
    const state = this._latestState(root);
    if (state) this.mesh.setResidency(state.id, 'warm');
    return this.getTask(taskId);
  }

  resume(taskId) {
    const root = this._taskRoot(taskId);
    if (!root) throw new Error(`Task not found in mesh: ${taskId}`);
    this.mesh.setResidency(root.id, 'hot');
    const state = this._latestState(root);
    if (state) this.mesh.setResidency(state.id, 'hot');
    return this.getTask(taskId);
  }

  pickNextRunnable() { return pickRunnableModel(this.listTasks()); }

  gist(taskId, { text = null, provenance = [] } = {}) {
    const root = this._taskRoot(taskId);
    if (!root) throw new Error(`Task not found in mesh: ${taskId}`);
    const current = this._latestState(root);
    const checkpoints = this.mesh.edgesFor(root.id).filter(edge => edge.from===root.id && edge.type==='has-checkpoint').map(edge=>edge.to);
    const sources = [root.id, current?.id, ...checkpoints.slice(-2)].filter(Boolean);
    return this.mesh.recordGist({
      id:`${root.id}:gist:${++this.mesh.seq}`,
      sourceIds:sources,
      text:text || `${current.attributes.model.title}; status ${current.attributes.model.status}; resume ${current.attributes.model.resumePoint?.step_key || 'complete'}`,
      address:{ task:taskId, status:current.attributes.model.status }, provenance:[current.id, ...provenance], residency:'cold',
      attributes:{ taskId, resumePoint:clone(current.attributes.model.resumePoint), blocker:clone(current.attributes.model.blocker) },
    });
  }
}

export default MeshContinuity;

// Synthia deterministic task-transition model.
// This module defines transition semantics only; canonical durable task state lives in the 5D mesh.

export const TASK_STATUS = Object.freeze({
  QUEUED: 'queued',
  ACTIVE: 'active',
  BACKGROUND_ACTIVE: 'background_active',
  WARM_WAIT: 'warm_wait',
  BLOCKED_WAITING_USER: 'blocked_waiting_user',
  BLOCKED_EXTERNAL: 'blocked_external',
  BLOCKED_CAPABILITY: 'blocked_capability',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const clone = v => JSON.parse(JSON.stringify(v));
const iso = ms => new Date(ms).toISOString();

export function normalizeStep(step, index = 0) {
  if (!step || typeof step !== 'object') throw new Error(`Invalid task step ${index}`);
  return {
    key: String(step.key || `step-${index + 1}`),
    label: String(step.label || step.key || `Step ${index + 1}`),
    executor: String(step.executor || (step.requires_user ? 'user' : 'server')),
    operation: String(step.operation || 'prepare'),
    requires_user: Boolean(step.requires_user),
    authorization_type: step.authorization_type ? String(step.authorization_type) : null,
    input: clone(step.input || {}),
    wait_seconds: Math.max(0, Number(step.wait_seconds) || 0),
  };
}

export function createTaskModel({ id = 'task:test', title = 'Untitled task', type = 'general', plan = [], priority = 0, warmWaitSeconds = 600, now = Date.now() } = {}) {
  if (!Array.isArray(plan) || !plan.length) throw new Error('Task plan must contain at least one step');
  return {
    id, title, type, priority: Number(priority) || 0,
    status: TASK_STATUS.QUEUED,
    plan: plan.map(normalizeStep),
    currentStep: 0,
    progress: 0,
    warmWaitSeconds: Math.max(0, Number(warmWaitSeconds) || 600),
    warmUntil: null,
    blocker: null,
    resumePoint: { step: 0, step_key: plan[0]?.key || 'step-1' },
    completedSteps: [],
    createdAt: iso(now),
    updatedAt: iso(now),
  };
}

export function advanceTaskModel(taskInput, { now = Date.now(), authorizedSteps = new Set(), serverCapabilities = new Set(['prepare','derive','record','checkpoint']) } = {}) {
  const task = clone(taskInput);
  const plan = task.plan || [];
  const step = plan[task.currentStep];
  task.updatedAt = iso(now);

  if (!step) {
    task.status = TASK_STATUS.COMPLETED;
    task.progress = 100;
    task.blocker = null;
    task.warmUntil = null;
    return task;
  }

  if ([TASK_STATUS.QUEUED, TASK_STATUS.ACTIVE].includes(task.status)) task.status = TASK_STATUS.BACKGROUND_ACTIVE;

  if (step.requires_user || step.executor === 'user') {
    if (authorizedSteps.has(step.key)) {
      task.completedSteps.push({ key: step.key, at: iso(now), cause: 'user-authorized' });
      task.currentStep += 1;
      task.progress = Math.round((task.currentStep / plan.length) * 10000) / 100;
      task.blocker = null;
      task.warmUntil = null;
      task.status = task.currentStep >= plan.length ? TASK_STATUS.COMPLETED : TASK_STATUS.BACKGROUND_ACTIVE;
      task.resumePoint = { step: task.currentStep, step_key: plan[task.currentStep]?.key || null };
      return task;
    }

    const warmUntilMs = task.warmUntil ? Date.parse(task.warmUntil) : now + task.warmWaitSeconds * 1000;
    if (!task.warmUntil) task.warmUntil = iso(warmUntilMs);
    task.blocker = {
      type: 'user_authorization',
      step_key: step.key,
      authorization_type: step.authorization_type || 'authorization',
      required: true,
    };
    task.resumePoint = { step: task.currentStep, step_key: step.key };
    task.status = now < warmUntilMs ? TASK_STATUS.WARM_WAIT : TASK_STATUS.BLOCKED_WAITING_USER;
    return task;
  }

  if (step.executor === 'server' && serverCapabilities.has(step.operation)) {
    task.completedSteps.push({ key: step.key, at: iso(now), cause: `server:${step.operation}` });
    task.currentStep += 1;
    task.progress = Math.round((task.currentStep / plan.length) * 10000) / 100;
    task.resumePoint = { step: task.currentStep, step_key: plan[task.currentStep]?.key || null };
    task.status = task.currentStep >= plan.length ? TASK_STATUS.COMPLETED : TASK_STATUS.BACKGROUND_ACTIVE;
    return task;
  }

  if (step.executor === 'external' && step.operation === 'wait') {
    task.status = TASK_STATUS.BLOCKED_EXTERNAL;
    task.blocker = { type: 'external_dependency', step_key: step.key, retry_at: iso(now + step.wait_seconds * 1000) };
    task.resumePoint = { step: task.currentStep, step_key: step.key };
    return task;
  }

  task.status = TASK_STATUS.BLOCKED_CAPABILITY;
  task.blocker = { type: 'capability', executor: step.executor, operation: step.operation, step_key: step.key };
  task.resumePoint = { step: task.currentStep, step_key: step.key };
  return task;
}

export function pickNextRunnable(tasks = []) {
  return [...tasks]
    .filter(t => [TASK_STATUS.BACKGROUND_ACTIVE, TASK_STATUS.ACTIVE, TASK_STATUS.WARM_WAIT, TASK_STATUS.QUEUED].includes(t.status))
    .sort((a,b) => {
      const rank = s => s === TASK_STATUS.WARM_WAIT ? 0 : (s === TASK_STATUS.ACTIVE || s === TASK_STATUS.BACKGROUND_ACTIVE ? 1 : 2);
      return rank(a.status) - rank(b.status) || (Number(b.priority)||0) - (Number(a.priority)||0) || String(a.createdAt||'').localeCompare(String(b.createdAt||''));
    })[0] || null;
}

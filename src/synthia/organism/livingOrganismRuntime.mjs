const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const clone = value => structuredClone(value);

export class LivingOrganismRuntime {
	constructor({ pulseMs = 250, memoryCapacity = 200, autonomy = 0.5 } = {}) {
		this.id = "synthia-living-organism";
		this.address = { dimension: "Being" };
		this.metadata = { capabilities: ["organism.pulse", "organism.propose", "organism.approve", "organism.reject", "organism.complete", "organism.remember", "organism.snapshot"] };
		this.pulseMs = Math.max(100, Number(pulseMs) || 250);
		this.memoryCapacity = Math.max(1, Number(memoryCapacity) || 200);
		this.state = {
			version: 1, generation: 0, lastPulseAt: null, autonomy: clamp(autonomy),
			metabolism: { energy: 0.82, stress: 0, circadianPhase: 0 },
			currentAction: null, pendingApproval: null, queue: [], episodes: [],
		};
	}

	manifest() { return { id: this.id, metadata: this.metadata, address: this.address }; }

	#signature(action) { return `${action.type || "task"}:${action.description || ""}`.trim().toLowerCase(); }

	propose(action) {
		if (!action?.description) throw new TypeError("Action requires a description.");
		const signature = this.#signature(action);
		const existing = [this.state.currentAction, this.state.pendingApproval, ...this.state.queue]
			.find(item => item && this.#signature(item) === signature);
		if (existing) return { status: "duplicate", action: clone(existing) };
		const entry = { id: action.id || `organism-action-${this.state.generation}-${this.state.queue.length + 1}`, type: "task", priority: 2, cost: 0.1, ...clone(action), status: "queued" };
		this.state.queue.push(entry);
		this.state.queue.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
		return { status: "queued", action: clone(entry) };
	}

	pulse(now = Date.now()) {
		const previous = this.state.lastPulseAt;
		if (previous !== null && now - previous < this.pulseMs) return { pulsed: false, waitMs: this.pulseMs - (now - previous), state: this.snapshot() };
		const elapsedMs = previous === null ? this.pulseMs : Math.max(0, now - previous);
		this.state.lastPulseAt = now;
		this.state.generation += 1;
		this.state.metabolism.energy = clamp(this.state.metabolism.energy + elapsedMs / 3_600_000 * 0.08);
		this.state.metabolism.stress = clamp(this.state.metabolism.stress - elapsedMs / 3_600_000 * 0.05);
		this.state.metabolism.circadianPhase = (now % 86_400_000) / 86_400_000;

		// Approval is a hard stop. No later decision may overwrite it or consume energy.
		if (!this.state.currentAction && !this.state.pendingApproval && this.state.queue.length) {
			const candidate = this.state.queue.shift();
			const canAutoRun = this.state.autonomy >= 0.8 && candidate.cost <= this.state.metabolism.energy;
			if (canAutoRun) this.#activate(candidate);
			else { candidate.status = "awaiting-approval"; this.state.pendingApproval = candidate; }
		}
		return { pulsed: true, state: this.snapshot() };
	}

	#activate(action) {
		action.status = "active";
		action.startedAt = this.state.lastPulseAt;
		this.state.metabolism.energy = clamp(this.state.metabolism.energy - clamp(action.cost));
		this.state.metabolism.stress = clamp(this.state.metabolism.stress + clamp(action.cost) * 0.25);
		this.state.currentAction = action;
	}

	approve() {
		if (!this.state.pendingApproval) return null;
		const action = this.state.pendingApproval;
		this.state.pendingApproval = null;
		this.#activate(action);
		return clone(action);
	}

	reject(reason = "rejected") {
		if (!this.state.pendingApproval) return null;
		const action = this.state.pendingApproval;
		this.state.pendingApproval = null;
		action.status = "rejected"; action.reason = String(reason);
		this.remember({ context: action.description, outcome: "rejected", valence: -0.2 });
		return clone(action);
	}

	complete(outcome = "completed") {
		if (!this.state.currentAction) return null;
		const action = this.state.currentAction;
		this.state.currentAction = null;
		action.status = "completed"; action.outcome = clone(outcome); action.completedAt = this.state.lastPulseAt;
		this.remember({ context: action.description, outcome, valence: 0.8 });
		return clone(action);
	}

	remember({ context, outcome = "observed", valence = 0, gates = [] } = {}) {
		const episode = { id: `episode-${this.state.generation}-${this.state.episodes.length + 1}`, context: String(context || "").slice(0, 500), outcome: clone(outcome), valence: clamp(valence, -1, 1), gates: [...new Set(gates.map(Number).filter(n => n >= 1 && n <= 64))], timestamp: this.state.lastPulseAt };
		this.state.episodes.push(episode);
		if (this.state.episodes.length > this.memoryCapacity) this.state.episodes.splice(0, this.state.episodes.length - this.memoryCapacity);
		return clone(episode);
	}

	snapshot() { return clone(this.state); }

	async run(input = {}) {
		switch (input.op) {
			case "pulse": return this.pulse(input.now);
			case "propose": return this.propose(input.action);
			case "approve": return this.approve();
			case "reject": return this.reject(input.reason);
			case "complete": return this.complete(input.outcome);
			case "remember": return this.remember(input.episode);
			case "snapshot": return this.snapshot();
			default: throw new RangeError(`Unknown organism operation: ${input.op}`);
		}
	}
}

export const livingOrganism = new LivingOrganismRuntime();
export default livingOrganism;


function clone(value) {
	return structuredClone(value);
}

function edgeKey(stateId, actionId) {
	return `${stateId}::${actionId}`;
}

function clamp(value, min = -1, max = 1) {
	return Math.max(min, Math.min(max, Number(value) || 0));
}

/**
 * Generic explicit micro state space with legal transitions, PUCT search,
 * bounded tactical search, tabular value/policy memory, self-play, and
 * portable serialization.
 *
 * It is a browser-native adaptation of the useful state/search template from
 * Micro-State-Space; no Streamlit/game UI or donor game rules are included.
 */
export class MicroStateSpace {
	constructor({ cPuct = 1.35, maxDepth = 6 } = {}) {
		this.cPuct = cPuct;
		this.maxDepth = maxDepth;
		this.states = new Map();
		this.transitions = new Map();
		this.q = new Map();
		this.policy = new Map();
		this.visits = new Map();
		this.stateVisits = new Map();
		this.episodes = [];
	}

	defineState(id, value = {}, { terminal = false } = {}) {
		const key = String(id);
		const state = Object.freeze({
			id: key,
			value: Object.freeze(clone(value)),
			terminal: Boolean(terminal),
		});
		this.states.set(key, state);
		if (!this.transitions.has(key)) this.transitions.set(key, new Map());
		return state;
	}

	addTransition(fromId, actionId, toId, {
		prior = 1,
		reward = 0,
		metadata = {},
	} = {}) {
		const from = this.states.get(String(fromId));
		const to = this.states.get(String(toId));
		if (!from || !to) throw new RangeError("Both transition states must be defined.");
		const id = String(actionId);
		const transition = Object.freeze({
			from: from.id,
			action: id,
			to: to.id,
			prior: Math.max(0, Number(prior) || 0),
			reward: clamp(reward),
			metadata: Object.freeze(clone(metadata)),
		});
		this.transitions.get(from.id).set(id, transition);
		const key = edgeKey(from.id, id);
		if (!this.policy.has(key)) this.policy.set(key, transition.prior);
		if (!this.q.has(key)) this.q.set(key, 0);
		if (!this.visits.has(key)) this.visits.set(key, 0);
		return transition;
	}

	legalTransitions(stateId) {
		return Object.freeze([...(this.transitions.get(String(stateId))?.values() || [])]);
	}

	isTerminal(stateId) {
		const state = this.states.get(String(stateId));
		if (!state) throw new RangeError(`Unknown micro state: ${stateId}`);
		return state.terminal || this.legalTransitions(stateId).length === 0;
	}

	#select(stateId) {
		const legal = this.legalTransitions(stateId);
		if (!legal.length) return null;
		const parentVisits = Math.max(1, this.stateVisits.get(stateId) || 0);
		let best = null;
		let bestScore = -Infinity;
		for (const transition of legal) {
			const key = edgeKey(stateId, transition.action);
			const q = this.q.get(key) || 0;
			const n = this.visits.get(key) || 0;
			const prior = Math.max(1e-9, this.policy.get(key) ?? transition.prior);
			const exploration = this.cPuct * prior * Math.sqrt(parentVisits) / (1 + n);
			const score = q + exploration;
			if (
				score > bestScore ||
				(score === bestScore && transition.action.localeCompare(best?.action || "") < 0)
			) {
				best = transition;
				bestScore = score;
			}
		}
		return best;
	}

	#simulate(stateId, evaluate, depth, path) {
		const state = this.states.get(stateId);
		if (!state) throw new RangeError(`Unknown micro state: ${stateId}`);
		if (state.terminal || depth >= this.maxDepth) {
			return clamp(evaluate(state));
		}
		const transition = this.#select(stateId);
		if (!transition) return clamp(evaluate(state));

		const key = edgeKey(stateId, transition.action);
		this.stateVisits.set(stateId, (this.stateVisits.get(stateId) || 0) + 1);
		const downstream = this.#simulate(
			transition.to,
			evaluate,
			depth + 1,
			path,
		);
		const value = clamp(transition.reward + downstream);
		const visits = (this.visits.get(key) || 0) + 1;
		const oldQ = this.q.get(key) || 0;
		this.visits.set(key, visits);
		this.q.set(key, oldQ + (value - oldQ) / visits);
		path.push(transition);
		return value;
	}

	search(rootId, {
		simulations = 64,
		evaluate = (state) => state.value?.score ?? 0,
	} = {}) {
		if (!this.states.has(String(rootId))) {
			throw new RangeError(`Unknown root state: ${rootId}`);
		}
		if (!Number.isInteger(simulations) || simulations < 1) {
			throw new RangeError("simulations must be a positive integer.");
		}
		for (let index = 0; index < simulations; index += 1) {
			this.#simulate(String(rootId), evaluate, 0, []);
		}
		const ranked = this.legalTransitions(rootId)
			.map((transition) => {
				const key = edgeKey(rootId, transition.action);
				return Object.freeze({
					transition,
					visits: this.visits.get(key) || 0,
					q: this.q.get(key) || 0,
					prior: this.policy.get(key) ?? transition.prior,
				});
			})
			.sort((left, right) => (
				right.visits - left.visits ||
				right.q - left.q ||
				left.transition.action.localeCompare(right.transition.action)
			));
		return Object.freeze({
			root: String(rootId),
			simulations,
			selected: ranked[0] || null,
			ranked: Object.freeze(ranked),
		});
	}

	tacticalSearch(rootId, {
		depth = 4,
		evaluate = (state) => state.value?.score ?? 0,
	} = {}) {
		if (!Number.isInteger(depth) || depth < 0) {
			throw new RangeError("depth must be a non-negative integer.");
		}
		const negamax = (stateId, remaining, alpha, beta) => {
			const state = this.states.get(stateId);
			const legal = this.legalTransitions(stateId);
			if (!state || state.terminal || remaining === 0 || !legal.length) {
				return clamp(evaluate(state));
			}
			let best = -Infinity;
			for (const transition of legal) {
				const score = transition.reward - negamax(
					transition.to,
					remaining - 1,
					-beta,
					-alpha,
				);
				best = Math.max(best, score);
				alpha = Math.max(alpha, score);
				if (alpha >= beta) break;
			}
			return clamp(best);
		};
		return negamax(String(rootId), depth, -Infinity, Infinity);
	}

	update(stateId, actionId, outcome, {
		learningRate = 0.2,
	} = {}) {
		const key = edgeKey(String(stateId), String(actionId));
		if (!this.q.has(key)) throw new RangeError(`Unknown state/action: ${key}`);
		const target = clamp(outcome);
		const current = this.q.get(key) || 0;
		const next = current + learningRate * (target - current);
		this.q.set(key, next);
		const prior = Math.max(1e-6, this.policy.get(key) || 1e-6);
		this.policy.set(key, Math.max(1e-6, prior * Math.exp(learningRate * target)));
		return Object.freeze({ key, q: next, policy: this.policy.get(key) });
	}

	selfPlay({
		rootId,
		episodes = 8,
		simulations = 24,
		evaluate,
	} = {}) {
		if (!Number.isInteger(episodes) || episodes < 1) {
			throw new RangeError("episodes must be a positive integer.");
		}
		const records = [];
		for (let episode = 0; episode < episodes; episode += 1) {
			const result = this.search(rootId, { simulations, evaluate });
			if (!result.selected) break;
			const targetState = this.states.get(result.selected.transition.to);
			const outcome = clamp(evaluate(targetState));
			this.update(rootId, result.selected.transition.action, outcome);
			const record = Object.freeze({
				episode: this.episodes.length + 1,
				action: result.selected.transition.action,
				outcome,
			});
			this.episodes.push(record);
			records.push(record);
		}
		return Object.freeze(records);
	}

	serialize() {
		return JSON.stringify({
			version: "synthia.micro-state-space.v1",
			cPuct: this.cPuct,
			maxDepth: this.maxDepth,
			states: [...this.states.values()],
			transitions: [...this.transitions.values()].flatMap((items) => [...items.values()]),
			q: Object.fromEntries(this.q),
			policy: Object.fromEntries(this.policy),
			visits: Object.fromEntries(this.visits),
			stateVisits: Object.fromEntries(this.stateVisits),
			episodes: this.episodes,
		});
	}

	static deserialize(serialized) {
		const data = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
		if (data?.version !== "synthia.micro-state-space.v1") {
			throw new TypeError("Unsupported micro-state-space snapshot.");
		}
		const world = new MicroStateSpace({ cPuct: data.cPuct, maxDepth: data.maxDepth });
		for (const state of data.states || []) {
			world.defineState(state.id, state.value, { terminal: state.terminal });
		}
		for (const transition of data.transitions || []) {
			world.addTransition(
				transition.from,
				transition.action,
				transition.to,
				transition,
			);
		}
		world.q = new Map(Object.entries(data.q || {}).map(([key, value]) => [key, Number(value)]));
		world.policy = new Map(Object.entries(data.policy || {}).map(([key, value]) => [key, Number(value)]));
		world.visits = new Map(Object.entries(data.visits || {}).map(([key, value]) => [key, Number(value)]));
		world.stateVisits = new Map(Object.entries(data.stateVisits || {}).map(([key, value]) => [key, Number(value)]));
		world.episodes = (data.episodes || []).map((item) => Object.freeze({ ...item }));
		return world;
	}
}

import ProblemSignature, {
	difference,
	normalizeState,
} from "./ProblemSignature.mjs";
import TransitionIndex from "./TransitionIndex.mjs";
import OutcomeVerifier from "./OutcomeVerifier.mjs";

function includesAll(have, required) {
	const set = new Set(have);
	return required.every((item) => set.has(item));
}

function transitionInputs(descriptor) {
	if (descriptor?.accepts?.status !== "checked") return [];
	return descriptor.accepts.value || [];
}

function transitionOutputs(descriptor) {
	if (descriptor?.produces?.status !== "checked") return [];
	return descriptor.produces.value || [];
}

function contextScore(descriptor, context = {}) {
	if (!descriptor.contexts?.length) return 1;
	const values = new Set(
		Object.entries(context)
			.flatMap(([key, value]) => [key, String(value)])
			.map((item) => String(item)),
	);
	const matched = descriptor.contexts.filter((item) => values.has(String(item))).length;
	return matched / descriptor.contexts.length;
}

export class TransitionResolver {
	constructor({
		index = new TransitionIndex(),
		verifier = new OutcomeVerifier(),
		activate = null,
		resonance = null,
		calculator = null,
		maxDepth = 8,
	} = {}) {
		this.id = "synthia-transition-resolver";
		this.index = index;
		this.verifier = verifier;
		this.activate = activate;
		this.resonance = resonance;
		this.calculator = calculator;
		this.maxDepth = Math.max(1, Number(maxDepth) || 8);
		this.history = [];
		this.capabilities = Object.freeze([
			"transition.register",
			"transition.resolve",
			"transition.solve",
			"transition.verify",
			"problem.signature",
		]);
	}

	signature(input = {}) {
		return new ProblemSignature(input);
	}

	register(descriptor) {
		return this.index.register(descriptor);
	}

	rank(candidates, {
		current = [],
		desired = [],
		context = {},
		scale = null,
		availability = null,
		address = null,
		history = [],
	} = {}) {
		const have = normalizeState(current);
		const wanted = normalizeState(desired);

		return Object.freeze(
			candidates
				.map((descriptor) => {
					const accepts = transitionInputs(descriptor);
					const produces = transitionOutputs(descriptor);
					const outputHits = wanted.filter((atom) => produces.includes(atom)).length;
					const outputScore = wanted.length ? outputHits / wanted.length : 0;
					const inputScore = accepts.length
						? accepts.filter((atom) => have.includes(atom)).length / accepts.length
						: 1;
					const scaleScore =
						scale == null || !descriptor.scales?.length
							? 1
							: descriptor.scales.includes(String(scale))
								? 1
								: 0;
					const calculation =
						typeof this.calculator?.calculate === "function"
							? this.calculator.calculate({
								current: have,
								desired: wanted,
								address,
								candidate: descriptor,
								context,
								history,
							})
							: null;
					const availableByHost =
						typeof availability === "function"
							? availability(descriptor)
							: true;
					const available = availableByHost && calculation?.permitted !== false;
					const resonance =
						typeof this.resonance?.score === "function"
							? Number(
								this.resonance.score([
									descriptor.componentId,
									...wanted.map((atom) => `state:${atom}`),
								])?.score || 0,
							)
							: 0;
					const score =
						available
							? (
								0.45 * outputScore +
								0.25 * inputScore +
								0.15 * contextScore(descriptor, context) +
								0.10 * scaleScore +
								0.05 * ((resonance + 1) / 2)
							)
							: -1;

					return Object.freeze({
						descriptor,
						score,
						available,
						outputScore,
						inputScore,
						calculation,
					});
				})
				.sort((a, b) => {
					const scoreDelta = b.score - a.score;
					if (scoreDelta !== 0) return scoreDelta;
					if (address) {
						const affinityDelta =
							Number(b.calculation?.addressAffinity || 0)
							- Number(a.calculation?.addressAffinity || 0);
						if (affinityDelta !== 0) return affinityDelta;
					}
					return a.descriptor.componentId.localeCompare(b.descriptor.componentId);
				}),
		);
	}

	resolve(current, desired, options = {}) {
		const signature = new ProblemSignature({
			current,
			desired,
			context: options.context || {},
			scale: options.scale ?? null,
			source: options.source || "transition-resolver",
		});

		if (signature.resolved) {
			return Object.freeze({
				status: "already-satisfied",
				signature,
				candidates: Object.freeze([]),
				selected: null,
			});
		}

		const candidates = this.index.findByOutput(signature.missing);
		const ranked = this.rank(candidates, {
			current: signature.current,
			desired: signature.missing,
			context: signature.context,
			scale: signature.scale,
			availability: options.availability || null,
			address: options.address || null,
			history: this.history,
		});

		return Object.freeze({
			status: ranked.length ? "candidate-found" : "unresolved",
			signature,
			candidates: ranked,
			selected: ranked[0] || null,
		});
	}

	#plan(current, desired, options, stack, depth) {
		const have = normalizeState(current);
		const wanted = normalizeState(desired);
		const missing = difference(have, wanted);
		if (!missing.length) return { state: have, steps: [] };
		if (depth > this.maxDepth) {
			throw new Error(`Transition resolution exceeded depth ${this.maxDepth}.`);
		}

		let state = [...have];
		const steps = [];

		for (const atom of missing) {
			if (state.includes(atom)) continue;
			const ranked = this.rank(this.index.findByOutput([atom]), {
				current: state,
				desired: [atom],
				context: options.context || {},
				scale: options.scale ?? null,
				availability: options.availability || null,
				address: options.address || null,
				history: this.history,
			});

			let solved = false;
			for (const candidate of ranked) {
				const descriptor = candidate.descriptor;
				if (stack.has(descriptor.componentId)) continue;
				const nextStack = new Set(stack);
				nextStack.add(descriptor.componentId);

				const requirements = [
					...transitionInputs(descriptor),
					...(descriptor.requires || []),
				].filter(Boolean);

				let prerequisiteState = state;
				let prerequisiteSteps = [];
				const unmet = requirements.filter((item) => !prerequisiteState.includes(item));
				if (unmet.length) {
					try {
						const prerequisite = this.#plan(
							prerequisiteState,
							unmet,
							options,
							nextStack,
							depth + 1,
						);
						prerequisiteState = prerequisite.state;
						prerequisiteSteps = prerequisite.steps;
					} catch {
						continue;
					}
				}

				if (!includesAll(prerequisiteState, requirements)) continue;

				state = [
					...new Set([
						...prerequisiteState,
						...transitionOutputs(descriptor),
					]),
				];
				steps.push(
					...prerequisiteSteps,
					Object.freeze({
						componentId: descriptor.componentId,
						address: descriptor.address,
						requires: Object.freeze(requirements),
						produces: Object.freeze(transitionOutputs(descriptor)),
						descriptor,
						calculation: candidate.calculation || null,
					}),
				);
				solved = state.includes(atom);
				if (solved) break;
			}

			if (!solved) {
				throw new Error(`No reachable transition produces required state: ${atom}`);
			}
		}

		return { state: Object.freeze(state), steps: Object.freeze(steps) };
	}

	plan(current, desired, options = {}) {
		const signature = new ProblemSignature({
			current,
			desired,
			context: options.context || {},
			scale: options.scale ?? null,
			source: options.source || "transition-resolver",
		});

		if (signature.resolved) {
			return Object.freeze({
				status: "already-satisfied",
				signature,
				steps: Object.freeze([]),
				projectedState: signature.current,
			});
		}

		try {
			const planned = this.#plan(
				signature.current,
				signature.desired,
				options,
				new Set(),
				0,
			);
			return Object.freeze({
				status: "planned",
				signature,
				steps: planned.steps,
				projectedState: planned.state,
			});
		} catch (error) {
			return Object.freeze({
				status: "unresolved",
				signature,
				steps: Object.freeze([]),
				projectedState: signature.current,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}

	async solve(current, desired, options = {}) {
		const plan = this.plan(current, desired, options);
		if (plan.status !== "planned") return plan;

		const activate = options.activate || this.activate;
		if (typeof activate !== "function") {
			return Object.freeze({
				...plan,
				status: "planned-not-executed",
				reason: "No capability activation function is attached.",
			});
		}

		let state = normalizeState(current);
		const executions = [];

		for (const step of plan.steps) {
			const before = state;
			const output = await activate(step.descriptor, {
				current: before,
				desired: normalizeState(desired),
				context: options.context || {},
				address: options.address || null,
				calculation: step.calculation || null,
			});

			const observedState =
				output?.state ??
				output?.afterState ??
				[
					...before,
					...step.produces,
				];

			state = normalizeState(observedState);
			executions.push(Object.freeze({
				componentId: step.componentId,
				address: step.address,
				before,
				after: state,
				output: output == null ? null : structuredClone(output),
			}));
		}

		const verification = this.verifier.compare({
			before: current,
			after: state,
			desired,
			evidence: executions,
		});

		if (verification.status !== "unresolved" && typeof this.resonance?.observe === "function") {
			const outcome =
				verification.status === "supported"
					? 1
					: verification.status === "conditional"
						? 0.25
						: -1;
			for (const execution of executions) {
				for (const desiredAtom of normalizeState(desired)) {
					this.resonance.observe({
						a: execution.componentId,
						b: `state:${desiredAtom}`,
						outcome,
						type: "transition-outcome",
						evidence: {
							before: execution.before,
							after: execution.after,
							verification: verification.status,
						},
						verified: true,
					});
				}
			}
		}

		const record = Object.freeze({
			id: `transition-resolution-${this.history.length + 1}`,
			status: verification.status === "supported" ? "solved" : "incomplete",
			plan,
			executions: Object.freeze(executions),
			verification,
		});
		this.history.unshift(record);
		this.history.length = Math.min(this.history.length, 128);
		return record;
	}

	async run(input = {}) {
		switch (input.op || input.operation) {
			case "signature":
				return this.signature(input);
			case "resolve":
				return this.resolve(input.current, input.desired, input.options || input);
			case "plan":
				return this.plan(input.current, input.desired, input.options || input);
			case "solve":
				return this.solve(input.current, input.desired, input.options || input);
			case "verify":
				return this.verifier.compare(input);
			case "snapshot":
				return this.snapshot();
			default:
				throw new Error(`Unknown TransitionResolver operation: ${input.op || input.operation}`);
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.transition-resolver.v1",
			index: this.index.snapshot(),
			calculator:
				typeof this.calculator?.snapshot === "function"
					? this.calculator.snapshot()
					: null,
			history: Object.freeze([...this.history]),
		});
	}
}

export default TransitionResolver;

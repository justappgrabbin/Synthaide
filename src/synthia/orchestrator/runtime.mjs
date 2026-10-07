
import { AutomataMesh, Automaton } from "../ato-core/automaton.mjs";
import { StateSpaceKernel } from "../ato-core/state-space-kernel.mjs";
import { CapabilityBroker } from "./capabilityBroker.mjs";
import { CompositionPredictor } from "./compositionPredictor.mjs";
import { ExperimentEngine, ExperimentModule, Action } from "./experimentEngine.mjs";
import { ExplorationController } from "./explorationController.mjs";
import { MicroStateSpace } from "./microStateSpace.mjs";
import { TaskAssignmentEngine } from "./taskAssignment.mjs";

function clamp01(value) {
	return Math.max(0, Math.min(1, Number(value) || 0));
}

function average(values) {
	if (!values.length) return 0;
	return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function goalIntent(text) {
	const value = String(text || "").toLowerCase();
	if (/\b(?:build|create|make|implement|generate|synthesize|write)\b/.test(value)) {
		return "build";
	}
	if (/\b(?:analy[sz]e|inspect|compare|evaluate|reason)\b/.test(value)) {
		return "analyze";
	}
	return "resolve";
}

function grammarCandidates(grammar, geometry, broker) {
	const rules = grammar?.rules || [];
	if (!rules.length) return [];
	const workers = broker.workers();
	const grammarWorkerFit = workers.some((worker) => (
		worker.capabilities.includes("grammar.generate")
	)) ? 1 : 0;
	const byId = new Map(rules.map((rule) => [rule.id, rule]));
	const candidates = [];

	for (const rule of rules.slice(0, 12)) {
		candidates.push({
			id: `composition:${rule.id}`,
			ruleIds: [rule.id],
			kind: "single-rule",
			features: {
				ruleCount: 1,
				support: clamp01(rule.score ?? rule.support / Math.max(1, grammar.exampleCount || 1)),
				affinity: clamp01(rule.score),
				complexity: 0.15,
				workerFit: grammarWorkerFit,
				novelty: clamp01(1 - (rule.support || 1) / Math.max(1, grammar.exampleCount || 1)),
				uncertainty: clamp01(1 - (rule.score || 0)),
				priorSuccess: 0.5,
			},
		});
	}

	for (const edge of (geometry?.edges || []).slice(0, 24)) {
		const left = byId.get(edge.from);
		const right = byId.get(edge.to);
		if (!left || !right) continue;
		candidates.push({
			id: `composition:${edge.from}+${edge.to}`,
			ruleIds: [edge.from, edge.to],
			kind: "geometry-pair",
			geometryEdge: edge.id,
			features: {
				ruleCount: 2,
				support: clamp01(average([left.score, right.score])),
				affinity: clamp01(edge.affinity),
				complexity: 0.3,
				workerFit: grammarWorkerFit,
				novelty: clamp01(1 - edge.similarity),
				uncertainty: clamp01(1 - edge.affinity),
				priorSuccess: 0.5,
			},
		});
	}
	return candidates;
}

function fallbackCandidates(intent, broker) {
	const workers = broker.workers();
	const capabilities = [...new Set(workers.flatMap((worker) => worker.capabilities))];
	const candidates = [];
	if (intent === "build" && capabilities.includes("tool.synthesize")) {
		candidates.push({
			id: "composition:tool-synthesis",
			ruleIds: [],
			kind: "tool-synthesis",
			features: {
				ruleCount: 0,
				support: 0.5,
				affinity: 0.6,
				complexity: 0.35,
				workerFit: 1,
				novelty: 0.4,
				uncertainty: 0.35,
				priorSuccess: 0.5,
			},
		});
	}
	if (!candidates.length) {
		candidates.push({
			id: "composition:local-resolution",
			ruleIds: [],
			kind: "local-resolution",
			features: {
				ruleCount: 0,
				support: 0.5,
				affinity: 0.5,
				complexity: 0.1,
				workerFit: 1,
				novelty: 0.25,
				uncertainty: 0.4,
				priorSuccess: 0.5,
			},
		});
	}
	return candidates;
}

function taskPlan(candidate, goal) {
	switch (candidate.kind) {
		case "tool-synthesis":
			return [{
				id: "task-tool-synthesis",
				capability: "tool.synthesize",
				input: { purpose: goal, input: goal },
				resource: "tool-factory",
			}];
		case "geometry-pair":
			return [
				{
					id: "task-grammar-generate",
					capability: "grammar.generate",
					input: {
						op: "generate",
						options: { ruleIds: candidate.ruleIds, maxApplications: 4 },
					},
					resource: "grammar-generator",
				},
				{
					id: "task-geometry-compose",
					capability: "geometry.compose",
					input: { op: "compose", path: candidate.ruleIds },
					resource: "grammar-geometry",
				},
			];
		case "single-rule":
			return [{
				id: "task-grammar-generate",
				capability: "grammar.generate",
				input: {
					op: "generate",
					options: { ruleIds: candidate.ruleIds, maxApplications: 4 },
				},
				resource: "grammar-generator",
			}];
		default:
			return [];
	}
}

function resultScore(executions, prediction) {
	if (!executions.length) {
		return Object.freeze({
			quality: clamp01(prediction.utility),
			cost: clamp01(prediction.cost * 0.5),
			accepted: true,
		});
	}
	const completed = executions.filter((item) => item.status === "complete").length;
	const successRatio = completed / executions.length;
	const quality = clamp01(successRatio * 0.72 + prediction.quality * 0.28);
	const cost = clamp01(
		prediction.cost * 0.55 +
		Math.min(1, executions.length / 8) * 0.45,
	);
	return Object.freeze({
		quality,
		cost,
		accepted: successRatio === 1 && quality >= 0.5,
	});
}

export class GenerativeExperimentOrchestrator {
	constructor({
		mesh = new AutomataMesh(),
		kernel = new StateSpaceKernel(),
		predictor = new CompositionPredictor(),
		exploration = new ExplorationController(),
		assigner = new TaskAssignmentEngine(),
		experiments = new ExperimentEngine(),
		toolMeshes = [],
	} = {}) {
		this.mesh = mesh;
		this.kernel = kernel;
		this.predictor = predictor;
		this.exploration = exploration;
		this.assigner = assigner;
		this.experiments = experiments;
		this.broker = new CapabilityBroker({ meshes: [mesh, ...toolMeshes] });
		this.history = [];
		this.last = null;
		this.#ensureBrokerModule();
	}

	#ensureBrokerModule() {
		if (this.experiments.modules.has("mesh-capabilities")) return;
		this.experiments.register(new ExperimentModule({
			id: "mesh-capabilities",
			actions: [
				new Action({
					id: "invoke",
					run: async (input) => {
						return this.broker.invoke(
							input.capability,
							input.payload,
							{ automatonId: input.automatonId },
						);
					},
				}),
			],
		}));
	}

	attachToolMesh(mesh) {
		this.broker.attach(mesh);
		return this;
	}

	detachToolMesh(mesh) {
		this.broker.detach(mesh);
		return this;
	}

	async #grammarStage(examples) {
		let grammarResult;
		if (Array.isArray(examples) && examples.length) {
			grammarResult = await this.broker.invoke("grammar.learn", {
				op: "learn",
				examples,
				options: { minSupport: 1 },
			});
		} else {
			grammarResult = await this.broker.invoke("grammar.snapshot", { op: "snapshot" });
		}
		const grammar = grammarResult.status === "complete"
			? grammarResult.output
			: null;
		if (!grammar?.ruleCount) {
			return Object.freeze({
				grammarResult,
				grammar,
				geometryResult: null,
				geometry: null,
			});
		}
		const geometryResult = await this.broker.invoke("geometry.build", {
			op: "build",
			grammar,
		});
		return Object.freeze({
			grammarResult,
			grammar,
			geometryResult,
			geometry: geometryResult.status === "complete" ? geometryResult.output : null,
		});
	}

	#planWorld(candidates, predictions, decision) {
		const world = new MicroStateSpace({ cPuct: 1.35, maxDepth: 3 });
		world.defineState("goal", { score: 0 }, { terminal: false });
		for (const candidate of candidates) {
			const prediction = predictions.get(candidate.id);
			const adjusted = this.exploration.adjust(prediction, candidate, decision);
			world.defineState(candidate.id, {
				score: adjusted - prediction.cost * 0.25,
				candidate,
				prediction,
			}, { terminal: true });
			world.addTransition("goal", candidate.id, candidate.id, {
				prior: Math.max(1e-4, adjusted),
				reward: 0,
				metadata: { candidateId: candidate.id },
			});
		}
		return world;
	}

	async #execute(assignments) {
		const steps = assignments.assigned.map((assignment) => ({
			moduleId: "mesh-capabilities",
			actionId: "invoke",
			input: {
				capability: assignment.capability,
				automatonId: assignment.workerId,
				payload: assignment.task.input,
			},
		}));
		if (!steps.length) return [];
		const run = await this.experiments.runRecipe({
			id: `orchestrator-${this.history.length + 1}`,
			steps,
		});
		return run.outputs.map((item, index) => {
			const assignment = assignments.assigned[index];
			const invocation = item.output;
			if (invocation.status === "complete") {
				this.assigner.complete(assignment.id, invocation.output);
			} else {
				this.assigner.release(assignment.id, invocation.error || invocation.status);
			}
			return Object.freeze({
				assignmentId: assignment.id,
				workerId: assignment.workerId,
				capability: assignment.capability,
				status: invocation.status,
				output: invocation.output,
				error: invocation.error || null,
			});
		});
	}

	async runGoal({
		goal,
		examples = [],
		simulations = 64,
		horizon = 3,
	} = {}) {
		const text = String(goal || "").trim();
		if (!text) throw new TypeError("Generative Experiment Orchestrator needs a goal.");
		const intent = goalIntent(text);
		const recognition = this.kernel.describe(text);
		const address = recognition.candidates[0]?.state?.address || null;

		const structural = await this.#grammarStage(examples);
		let candidates = grammarCandidates(
			structural.grammar,
			structural.geometry,
			this.broker,
		);
		if (intent === "build") {
			const buildCandidates = fallbackCandidates(intent, this.broker)
				.filter((candidate) => candidate.kind === "tool-synthesis");
			candidates = [...candidates, ...buildCandidates];
		}
		if (!candidates.length) candidates = fallbackCandidates(intent, this.broker);

		const predictions = new Map();
		for (const candidate of candidates) {
			predictions.set(candidate.id, this.predictor.predict(candidate));
		}
		const meanConfidence = average([...predictions.values()].map((item) => item.confidence));
		const meanUncertainty = average(candidates.map((item) => item.features.uncertainty));
		const meanNovelty = average(candidates.map((item) => item.features.novelty));
		const exploration = this.exploration.select({
			confidence: meanConfidence,
			uncertainty: meanUncertainty,
			novelty: meanNovelty,
			horizon,
		});

		const world = this.#planWorld(candidates, predictions, exploration);
		const search = world.search("goal", {
			simulations,
			evaluate: (state) => state?.value?.score ?? 0,
		});
		if (!search.selected) throw new Error("No legal composition candidate was found.");
		const candidate = search.selected.transition.metadata.candidateId
			? candidates.find((item) => item.id === search.selected.transition.metadata.candidateId)
			: candidates.find((item) => item.id === search.selected.transition.to);
		const prediction = predictions.get(candidate.id);

		const workers = this.broker.workers();
		this.assigner.clearWorkers();
		this.assigner.registerWorkers(workers);
		const tasks = taskPlan(candidate, text);
		const assignments = this.assigner.assign(tasks);
		const executions = await this.#execute(assignments);
		const score = resultScore(executions, prediction);

		this.predictor.learn(candidate, score);
		world.update("goal", candidate.id, score.quality - score.cost * 0.3);

		const result = Object.freeze({
			kind: "synthia.generative-experiment.result.v1",
			goal: text,
			intent,
			address,
			recognition: Object.freeze({
				candidateCount: recognition.candidates.length,
				addressKey: recognition.candidates[0]?.state?.addressKey || null,
			}),
			structural,
			candidates: Object.freeze(candidates.map((item) => Object.freeze({
				...structuredClone(item),
				prediction: predictions.get(item.id),
			}))),
			exploration,
			search,
			selected: Object.freeze({
				candidate: Object.freeze(structuredClone(candidate)),
				prediction,
			}),
			assignments,
			executions: Object.freeze(executions),
			score,
			learning: Object.freeze({
				predictorSamples: this.predictor.samples,
				microState: JSON.parse(world.serialize()),
			}),
		});
		this.last = result;
		this.history.unshift(result);
		this.history.length = Math.min(this.history.length, 100);
		return result;
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.generative-experiment-orchestrator.v1",
			historyCount: this.history.length,
			last: this.last,
			predictor: this.predictor.snapshot(),
			exploration: this.exploration.snapshot(),
			assigner: this.assigner.snapshot(),
			experiments: this.experiments.snapshot(),
			broker: this.broker.snapshot(),
		});
	}
}

export function generativeExperimentOrchestratorAutomaton({
	runtime = new GenerativeExperimentOrchestrator(),
} = {}) {
	return new Automaton({
		id: "generative-experiment-orchestrator",
		address: {
			mode: "macro",
			gate: 5,
			line: 1,
			color: 1,
			tone: 1,
			base: 1,
		},
		structure: "hexagram",
		activeLevels: [1, 2, 3, 4, 5],
		functionalLevel: "mind",
		ports: [
			{
				id: "goal",
				direction: "input",
				type: "goal",
				schemaVersion: "1",
			},
			{
				id: "result",
				direction: "output",
				type: "experiment-result",
				schemaVersion: "1",
				guarantees: ["searched", "assigned", "executed", "scored"],
			},
		],
		state: runtime,
		metadata: {
			family: "generative-experiment-orchestrator",
			independent: true,
			capabilities: Object.freeze(["orchestrator.run", "orchestrator.snapshot"]),
		},
		implementation: (input, { state }) => {
			if (input?.op === "snapshot") return state.snapshot();
			return state.runGoal(input);
		},
	});
}

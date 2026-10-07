
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { AutomataMesh } from "../src/synthia/ato-core/automaton.mjs";
import { DataEfficientGrammar, degGrammarAutomaton } from "../src/synthia/deg/grammar.mjs";
import { geoDegAutomaton } from "../src/synthia/geo-deg/geometry.mjs";
import { MicroStateSpace } from "../src/synthia/orchestrator/microStateSpace.mjs";
import { CompositionPredictor } from "../src/synthia/orchestrator/compositionPredictor.mjs";
import { ExplorationController } from "../src/synthia/orchestrator/explorationController.mjs";
import { TaskAssignmentEngine } from "../src/synthia/orchestrator/taskAssignment.mjs";
import {
	Variable,
	Action,
	ExperimentModule,
	ExperimentEngine,
} from "../src/synthia/orchestrator/experimentEngine.mjs";
import {
	GenerativeExperimentOrchestrator,
	generativeExperimentOrchestratorAutomaton,
} from "../src/synthia/orchestrator/runtime.mjs";

const EXAMPLES = [
	"alpha beta gamma",
	"alpha beta delta",
	"beta gamma epsilon",
];

test("Micro-State-Space template keeps explicit legal transitions and PUCT memory", () => {
	const world = new MicroStateSpace({ cPuct: 1.2, maxDepth: 3 });
	world.defineState("root", { score: 0 });
	world.defineState("weak", { score: 0.2 }, { terminal: true });
	world.defineState("strong", { score: 0.9 }, { terminal: true });
	world.addTransition("root", "weak", "weak", { prior: 0.2 });
	world.addTransition("root", "strong", "strong", { prior: 0.8 });

	assert.deepEqual(
		world.legalTransitions("root").map((item) => item.action),
		["weak", "strong"],
	);
	const result = world.search("root", {
		simulations: 48,
		evaluate: (state) => state.value.score,
	});
	assert.equal(result.selected.transition.action, "strong");
	assert.ok(result.selected.visits > 0);

	const restored = MicroStateSpace.deserialize(world.serialize());
	assert.equal(restored.legalTransitions("root").length, 2);
	assert.ok(restored.q.size > 0);
});

test("Composition predictor learns from executed quality/cost outcomes", () => {
	const predictor = new CompositionPredictor({ seed: 7 });
	const candidate = {
		features: {
			ruleCount: 2,
			support: 0.8,
			affinity: 0.9,
			complexity: 0.25,
			workerFit: 1,
			novelty: 0.2,
			uncertainty: 0.3,
			priorSuccess: 0.5,
		},
	};
	const before = predictor.predict(candidate);
	for (let i = 0; i < 40; i += 1) {
		predictor.learn(candidate, { quality: 1, cost: 0.1 });
	}
	const after = predictor.predict(candidate);

	assert.equal(predictor.samples, 40);
	assert.ok(after.quality > before.quality);
	assert.ok(after.cost < before.cost);
});

test("exploration controller has distinct exploit, uncertainty, novelty, and value-free modes", () => {
	const controller = new ExplorationController({ valueFreePeriod: 2 });
	const uncertainty = controller.select({
		confidence: 0.2,
		uncertainty: 0.9,
		novelty: 0.1,
		horizon: 4,
	});
	const novelty = controller.select({
		confidence: 0.9,
		uncertainty: 0.1,
		novelty: 0.9,
		horizon: 2,
	});
	const valueFree = controller.select({
		confidence: 0.9,
		uncertainty: 0.1,
		novelty: 0.1,
		horizon: 5,
	});

	assert.equal(uncertainty.strategy, "uncertainty-directed");
	assert.equal(novelty.strategy, "novelty");
	assert.equal(valueFree.strategy, "exploit");
	const fourth = controller.select({
		confidence: 0.9,
		uncertainty: 0.1,
		novelty: 0.1,
		horizon: 5,
	});
	assert.equal(fourth.strategy, "value-free");
});

test("task assignment keeps workers separate, detects resource collisions, and releases stalls", () => {
	const engine = new TaskAssignmentEngine({ stallLimit: 2 });
	engine.registerWorkers([
		{ id: "grammar-a", capabilities: ["grammar.generate"] },
		{ id: "geometry-a", capabilities: ["geometry.compose"] },
	]);
	const result = engine.assign([
		{
			id: "generate-1",
			capability: "grammar.generate",
			resource: "grammar",
		},
		{
			id: "generate-2",
			capability: "grammar.generate",
			resource: "grammar",
		},
		{
			id: "compose",
			capability: "geometry.compose",
			resource: "geometry",
		},
	]);

	assert.equal(result.assigned.length, 2);
	assert.equal(result.pending.length, 1);
	assert.equal(result.pending[0].reason, "RESOURCE_COLLISION");

	const blocked = result.assigned[0].id;
	assert.equal(engine.tick([blocked]).length, 0);
	const released = engine.tick([blocked]);
	assert.equal(released.length, 1);
	assert.equal(released[0].status, "released");
});

test("Autolab-style experiment abstraction exposes Variable, Action, Module, and Recipe without Python runtime", async () => {
	const engine = new ExperimentEngine();
	const module = new ExperimentModule({
		id: "counter",
		variables: [
			new Variable({
				id: "value",
				value: 1,
				validate: (value) => Number.isFinite(value),
			}),
		],
		actions: [
			new Action({
				id: "increment",
				run: (input, { module: self }) => {
					const next = self.read("value") + Number(input.by || 1);
					self.write("value", next);
					return next;
				},
			}),
		],
	});
	engine.register(module);
	const run = await engine.runRecipe({
		id: "increment-twice",
		steps: [
			{ moduleId: "counter", actionId: "increment", input: { by: 2 } },
			{ moduleId: "counter", actionId: "increment", input: { by: 3 } },
		],
	});

	assert.equal(module.read("value"), 6);
	assert.equal(run.outputs.length, 2);
	assert.equal(run.outputs[1].output, 6);
});

test("Generative Experiment Orchestrator executes DEG → Geo-DEG → predictor → PUCT → assignment → execution → learning", async () => {
	const toolMesh = new AutomataMesh();
	const deg = toolMesh.add(degGrammarAutomaton());
	const geo = toolMesh.add(geoDegAutomaton());
	const orchestrator = new GenerativeExperimentOrchestrator({
		toolMeshes: [toolMesh],
	});
	const result = await orchestrator.runGoal({
		goal: "Construct a reusable structural composition.",
		examples: EXAMPLES,
		simulations: 64,
		horizon: 4,
	});

	assert.ok(result.structural.grammar.ruleCount > 0);
	assert.equal(result.structural.geometry.nodeCount, result.structural.grammar.ruleCount);
	assert.ok(result.candidates.length > 0);
	assert.ok(result.search.selected);
	assert.ok(result.assignments.assigned.length >= 1);
	assert.ok(result.executions.length >= 1);
	assert.equal(result.score.accepted, true);
	assert.equal(orchestrator.predictor.samples, 1);
	assert.notEqual(deg.ownedState, geo.ownedState);
});

test("orchestrator is an ATO but DEG and Geo-DEG remain external independent automatons", async () => {
	const toolMesh = new AutomataMesh();
	toolMesh.add(degGrammarAutomaton());
	toolMesh.add(geoDegAutomaton());
	const runtime = new GenerativeExperimentOrchestrator({
		toolMeshes: [toolMesh],
	});
	const automaton = generativeExperimentOrchestratorAutomaton({ runtime });
	const result = await automaton.call({
		goal: "Explore reusable structure.",
		examples: EXAMPLES,
		simulations: 20,
	});

	assert.equal(automaton.id, "generative-experiment-orchestrator");
	assert.equal(automaton.metadata.independent, true);
	assert.equal(runtime.mesh.automatons.has("deg-grammar-learner"), false);
	assert.equal(runtime.mesh.automatons.has("geo-deg-grammar-geometry"), false);
	assert.ok(result.selected.candidate);
});

test("orchestrator source has no direct implementation imports of DEG or Geo-DEG", () => {
	const source = fs.readFileSync(
		new URL("../src/synthia/orchestrator/runtime.mjs", import.meta.url),
		"utf8",
	);
	assert.doesNotMatch(source, /from\s+["'][^"']*\/deg\//i);
	assert.doesNotMatch(source, /from\s+["'][^"']*\/geo-deg\//i);
});

test("legacy front-door logic is replaced rather than hidden", () => {
	const engine = fs.readFileSync(
		new URL("../src/synthia/atoEngine.js", import.meta.url),
		"utf8",
	);
	const state = fs.readFileSync(
		new URL("../src/synthia/stateSpace.js", import.meta.url),
		"utf8",
	);
	const welcome = fs.readFileSync(
		new URL("../src/pages/welcome/welcome.js", import.meta.url),
		"utf8",
	);

	assert.doesNotMatch(engine, /AUTOLING|DISEMINER|stateSpace\.commit/);
	assert.doesNotMatch(state, /2166136261|Math\.imul\(value,\s*16777619\)|function hash/);
	assert.match(engine, /synthiaRuntime\.mjs/);
	assert.match(state, /canonicalState\.mjs/);
	assert.match(welcome, /await synthia\.process\(text\)/);
	assert.doesNotMatch(welcome, /ato\.process/);
});

test("canonical state projection derives from the ATO StateSpaceKernel, not a second text hash", async () => {
	const { default: canonicalState } = await import(
		"../src/synthia/canonicalState.mjs"
	);
	const one = canonicalState.resolve("same semantic cue");
	const two = canonicalState.resolve("same semantic cue");

	assert.deepEqual(one, two);
	assert.equal(canonicalState.kernel.states.size >= 64, true);
	assert.ok(one.gate >= 1 && one.gate <= 64);
	assert.ok(one.base >= 1 && one.base <= 5);
});

import test from "node:test";
import assert from "node:assert/strict";

import fixture from "../src/synthia/neural/humanDesignGNNFixture.mjs";
import {
	CHANNEL_EDGES,
	TRAINING_METADATA,
	inferHumanDesignGNN,
	HumanDesignGNNRuntime,
} from "../src/synthia/neural/humanDesignGNN.mjs";
import {
	ConnectionFieldRuntime,
	CONNECTION_FIELD_SCHEMA,
	DONOR_DIMENSIONS,
	FORMS,
	PROJECTION_BINDINGS,
} from "../src/synthia/neural/connectionField.mjs";
import {
	GenerativeChannelRuntime,
	PROCESS_CHANNEL_PAIRS,
	levelToPhase,
} from "../src/synthia/neural/generativeChannelField.mjs";
import {
	ARCHITECTURE_FAMILY_IDS,
	NeuralArchitectureRuntime,
	applyModulation,
	createCapabilitySubstrate,
	createComposition,
	createSemanticRoutes,
	forwardArchitecture,
	runComposition,
	trainArchitecture,
} from "../src/synthia/neural/architectureModulation.mjs";
import { LivingMeshRuntime } from "../src/synthia/livingMeshRuntime.mjs";
import { SynthiaRuntime } from "../src/synthia/synthiaRuntime.mjs";

function maxDifference(actual, expected) {
	let maximum = 0;
	for (let index = 0; index < actual.length; index += 1) {
		maximum = Math.max(maximum, Math.abs(actual[index] - expected[index]));
	}
	return maximum;
}

test("browser Human Design GNN reproduces the trained PyTorch checkpoint fixture", () => {
	const output = inferHumanDesignGNN(fixture.placements);
	assert.equal(CHANNEL_EDGES.length, 36);
	assert.equal(output.codons.length, 64);
	assert.ok(maxDifference(output.codons, fixture.expected.codons) < 1e-6);
	assert.ok(Math.abs(output.spleen - fixture.expected.spleen[0]) < 1e-6);
	assert.ok(Math.abs(output.ajna - fixture.expected.ajna[0]) < 1e-6);
	assert.ok(
		Math.abs(output.solarPlexus - fixture.expected.solar_plexus[0]) < 1e-6,
	);
	assert.ok(Math.abs(output.heart - fixture.expected.heart[0]) < 1e-6);
	assert.ok(Math.abs(output.mind - fixture.expected.mind[0]) < 1e-6);
	assert.equal(TRAINING_METADATA.epoch, 10);
	assert.equal(TRAINING_METADATA.labelSource, "synthetic-rule-supervision");
});

test("trained Human Design GNN remains an independent callable node", async () => {
	const runtime = new HumanDesignGNNRuntime();
	const output = await runtime.call({ placements: fixture.placements });
	assert.equal(output.codons.length, 64);
	assert.equal(runtime.snapshot().channelEdges, 36);
	assert.ok(runtime.metadata.capabilities.includes("neural.human-design.infer"));
});

test("perspective connection field keeps one 64-node state with 36 links per node across five projections", async () => {
	const runtime = new ConnectionFieldRuntime({ seed: 7 });
	assert.equal(runtime.model.nodes.length, CONNECTION_FIELD_SCHEMA.nodes);
	assert.equal(DONOR_DIMENSIONS.length, 5);
	assert.equal(Object.keys(PROJECTION_BINDINGS).length, 5);
	for (const node of runtime.model.nodes) {
		assert.equal(node.connections.length, 36);
		assert.equal(node.filters.length, 13);
		assert.equal(node.resolutions.length, 5);
		assert.equal(node.forms.length, 5);
		assert.ok(node.forms.every((form) => FORMS.includes(form)));
	}
	const reaction = runtime.observeCue({ address: { gate: 29 } });
	assert.equal(reaction.gate, 29);
	assert.equal(reaction.step, 1);
	assert.deepEqual(
		Object.keys(reaction.projections).sort(),
		["causal", "dependency", "knowledge", "phase", "temporal"],
	);

	const inputs = new Array(64).fill(0);
	const targets = new Array(64).fill(0);
	inputs[0] = 1;
	targets[1] = 1;
	const report = await runtime.call({
		op: "train",
		examples: [{ inputs, targets }],
		epochs: 5,
		learningRate: 0.05,
	});
	assert.equal(report.lossHistory.length, 5);
	assert.ok(report.lossHistory.at(-1) < report.lossHistory[0]);
});

test("generative process preserves its donor hierarchy while using the verified 36-edge HD graph as the active adapter", () => {
	assert.equal(PROCESS_CHANNEL_PAIRS.length, 34);
	const runtime = new GenerativeChannelRuntime();
	assert.equal(runtime.snapshot().channelCount, 36);
	assert.equal(levelToPhase(0), "bigram");
	assert.equal(levelToPhase(3), "trigram");
	assert.equal(levelToPhase(6), "hexagram");
	assert.equal(levelToPhase(9), "channel");
	assert.equal(levelToPhase(12), "transcendent");

	runtime.observeGate(10, { delta: 4 });
	runtime.observeGate(20, { delta: 4 });
	const junction = runtime.observeGate(34, { delta: 4 });
	assert.ok(junction.emergent);
	assert.equal(junction.emergent.type, "auto-novel");
	assert.ok([10, 20, 34].includes(junction.emergent.sharedGate));
});

test("all 36 architecture-generator families execute and its neural layer modulates rather than owns capabilities", () => {
	assert.equal(ARCHITECTURE_FAMILY_IDS.length, 36);
	for (const family of ARCHITECTURE_FAMILY_IDS) {
		const prediction = forwardArchitecture(family, [0.1, 0.4, 0.7, 0.9]);
		assert.equal(prediction.probabilities.length, 3);
		assert.ok(prediction.probabilities.every(Number.isFinite));
	}
	const report = trainArchitecture("mlp", 5, 1);
	assert.ok(report.afterLoss < report.beforeLoss);

	const composition = createComposition("capability-field", ["mlp", "gat", "moe"]);
	const run = runComposition(composition, [0.1, 0.4, 0.7, 0.9]);
	const substrate = createCapabilitySubstrate([
		{ id: "tool.alpha", activation: 0.3 },
		{ id: "tool.beta", activation: 0.7 },
	]);
	const routes = createSemanticRoutes(substrate.capabilities.map(({ id }) => id));
	const modulated = applyModulation(substrate, run, routes);
	assert.deepEqual(
		modulated.capabilities.map(({ id }) => id),
		substrate.capabilities.map(({ id }) => id),
	);
	assert.notDeepEqual(
		modulated.capabilities.map(({ activation }) => activation),
		substrate.capabilities.map(({ activation }) => activation),
	);
});

test("architecture generator is a sovereign mesh capability, not a capability registry replacement", async () => {
	const runtime = new NeuralArchitectureRuntime();
	const composition = await runtime.call({
		op: "generate",
		seed: 42,
		nodeCount: 6,
	});
	const result = await runtime.call({
		op: "run",
		composition: composition.id,
		input: [0.2, 0.3, 0.5, 0.8],
	});
	assert.equal(result.steps, 6);
	assert.equal(runtime.snapshot().families, 36);
	assert.equal(runtime.metadata.role, "capability-modulation-not-capability-ownership");
});

test("current Synthia runtime mounts neural functions as independent living-mesh nodes and cue events actually reach the connection field", async () => {
	const meshRuntime = new LivingMeshRuntime();
	const runtime = new SynthiaRuntime({ meshRuntime });
	const ids = new Set(meshRuntime.capabilities().map(({ id }) => id));
	for (const id of [
		"perspective-connection-field",
		"generative-channel-field",
		"human-design-gnn",
		"neural-architecture-generator",
	]) {
		assert.ok(ids.has(id), `missing neural mesh node ${id}`);
	}
	const response = await runtime.process("compare this structure with what changed");
	assert.ok(response.mesh.reactions["perspective-connection-field"]);
	assert.equal(
		response.mesh.reactions["perspective-connection-field"].gate,
		response.address.gate,
	);
	const serialized = JSON.stringify(runtime.snapshot());
	assert.doesNotMatch(serialized, /input_proj\.weight|lin_self\.weight/);
});

test("verified runtime outcomes feed channel emergence state without exposing another node's internal state", () => {
	const meshRuntime = new LivingMeshRuntime();
	const runtime = new SynthiaRuntime({ meshRuntime });
	const before = runtime.neural.generativeChannels.snapshot().gateLevels[28];
	const feedback = meshRuntime.observeOutcome({
		cueId: "test-cue",
		nodeId: "test-node",
		output: { ok: true },
		quality: 1,
		address: { gate: 29, line: 1, color: 1, tone: 1, base: 1 },
	});
	const after = runtime.neural.generativeChannels.snapshot().gateLevels[28];
	assert.equal(after, before + 1);
	assert.equal(
		feedback.reactions["generative-channel-field"].gate,
		29,
	);
});

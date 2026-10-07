import test from "node:test";
import assert from "node:assert/strict";

import {
	IntegratedFactoryGrowthAdapter,
	LivingMeshRuntime,
	PROJECTIONS,
} from "../src/synthia/livingMeshRuntime.mjs";
import { SynthesisRuntime } from "../src/synthia/synthesisRuntime.mjs";

function canonicalAddress(overrides = {}) {
	return {
		dimension: "Being",
		gate: 24,
		line: 2,
		color: 3,
		tone: 4,
		base: 5,
		degree: 17,
		minute: 21,
		second: 44,
		zodiac: "Leo",
		house: 5,
		...overrides,
	};
}

test("living mesh activates all five distinct graph projections and the canonical tool population", () => {
	const runtime = new LivingMeshRuntime();
	const snapshot = runtime.snapshot();

	assert.equal(snapshot.canonicalToolCount, 16);
	assert.equal(snapshot.automata, 17); // 16 canonical + boot-grown media-field
	assert.deepEqual(Object.keys(snapshot.metrics.projections), PROJECTIONS);
	for (const projection of PROJECTIONS) {
		assert.ok(snapshot.metrics.projections[projection].nodes >= 64);
		assert.ok(snapshot.metrics.projections[projection].edges >= 64);
	}
	assert.equal(snapshot.phase.stageOrder.length, 5);
});

test("cue processing records semantic triples, all five phase stages, and canonical-address bridging", async () => {
	const runtime = new LivingMeshRuntime();
	const before = runtime.snapshot().tripleCount;
	const result = await runtime.processCue(
		"compare this structure and explain the relation",
		{ address: canonicalAddress() },
	);
	const after = runtime.snapshot();

	assert.equal(result.phase.complete, true);
	assert.deepEqual(
		result.phase.trace.map((stage) => stage.stage),
		["Movement", "Evolution", "Being", "Design", "Space"],
	);
	assert.ok(result.semantic);
	assert.ok(after.tripleCount > before);
	assert.ok(
		runtime.engine.triples({
			subject: result.id,
			predicate: "hasCanonicalPublicAddress",
		}).length > 0,
	);
	assert.ok(
		runtime.engine.triples({
			predicate: "candidateAddressProjectsTo",
		}).length > 0,
	);
});

test("public anticipatory memory never exposes private coordinates or raw content", async () => {
	const runtime = new LivingMeshRuntime();
	await runtime.processCue("private sentence that must not enter public memory", {
		address: canonicalAddress(),
		context: {
			rawText: "DO NOT SHARE",
			conversation: "PRIVATE",
			sessionId: "session-secret",
		},
		runTools: false,
	});

	const serialized = JSON.stringify(runtime.snapshot().publicMemory);
	assert.doesNotMatch(serialized, /DO NOT SHARE|PRIVATE|session-secret/);
	assert.doesNotMatch(serialized, /"degree"|"minute"|"second"|"zodiac"|"house"/);
	assert.match(serialized, /"gate":24/);
});

test("independent current nodes join by proxy without transferring owned state into the shared snapshot", async () => {
	const runtime = new LivingMeshRuntime();
	const source = {
		id: "independent-test-node",
		address: { gate: 33, line: 1, color: 1, tone: 1, base: 1 },
		metadata: { capabilities: ["test.echo"] },
		ownedState: { secret: "PRIVATE_NODE_STATE" },
		async call(input) {
			return { echoed: input };
		},
	};

	const proxy = runtime.attachATO(source, {
		dimension: "Space",
		origin: "test-current-node",
	});
	const run = proxy.run({ value: 7 });
	const semanticOutput = await Promise.resolve(run.output);
	const output = await runtime.invoke(source.id, { value: 7 });

	assert.deepEqual(semanticOutput, { echoed: { value: 7 } });
	assert.deepEqual(output, { echoed: { value: 7 } });
	assert.equal(runtime.privateBindings.get(source.id), source);
	assert.doesNotMatch(JSON.stringify(runtime.snapshot()), /PRIVATE_NODE_STATE/);
	assert.ok(
		runtime.engine.triples({
			subject: source.id,
			predicate: "boundToCurrentImplementation",
		}).length > 0,
	);
});

test("actual repeated information crossings promote an emergent channel", async () => {
	const runtime = new LivingMeshRuntime();

	for (let count = 0; count < 3; count += 1) {
		const crossing = await runtime.transmit({
			from: "autoling",
			to: "diseminer",
			payload: { count },
		});
		assert.equal(crossing.receipt.delivered, true);
	}

	const channel = runtime.engine.channelCapability("autoling", "diseminer");
	assert.ok(channel);
	assert.equal(channel.tools.includes("autoling"), true);
	assert.equal(channel.tools.includes("diseminer"), true);
	assert.ok(
		runtime.snapshot().emergentChannels.some(
			(entry) =>
				entry.a === "autoling" && entry.b === "diseminer" ||
				entry.a === "diseminer" && entry.b === "autoling",
		),
	);
});

test("semantic growth delegates to the active Integrated Tool Factory instead of the preserved Kimi factory", async () => {
	const synthesis = new SynthesisRuntime();
	const runtime = new LivingMeshRuntime({
		factoryAdapter: new IntegratedFactoryGrowthAdapter({ runtime: synthesis }),
	});
	const result = await runtime.processCue(
		"invent a frobnicator for xylophonic tensor petals",
		{ address: canonicalAddress({ dimension: "Design", gate: 17 }) },
	);

	assert.equal(result.semantic.mode, "grown");
	assert.match(result.semantic.toolId, /^tool-/);
	assert.ok(synthesis.get(result.semantic.toolId));
	assert.ok(runtime.engine.mesh.get(result.semantic.toolId));
	assert.ok(
		runtime.engine.triples({
			subject: result.semantic.toolId,
			predicate: "isA",
			object: "Automaton",
		}).length > 0,
	);
});

test("the experiment stack is represented as one mesh node rather than owning the semantic mesh", async () => {
	const { SynthiaRuntime } = await import("../src/synthia/synthiaRuntime.mjs");
	const runtime = new SynthiaRuntime({
		meshRuntime: new LivingMeshRuntime(),
	});
	const result = await runtime.process("build a local state tool");

	assert.equal(result.path[0], "semantic-mesh");
	assert.ok(result.path.includes("puct"));
	assert.ok(
		runtime.meshRuntime.capabilities().some(
			(node) => node.id === "generative-experiment-orchestrator" && node.proxy,
		),
	);
	assert.notEqual(runtime.meshRuntime.engine, runtime.orchestrator);
});

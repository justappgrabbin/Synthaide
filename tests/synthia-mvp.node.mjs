import assert from "node:assert/strict";
import test from "node:test";

import {
	AutomataMesh,
	Automaton,
} from "../src/synthia/ato-core/automaton.mjs";
import {
	SemanticCompletion,
	TRACE_LAYERS,
} from "../src/synthia/ato-core/trace-firing.mjs";
import { ATONativeBridge } from "../src/synthia/integrated-tool-factory/ato-native-bridge.mjs";
import {
	IntegratedToolFactory,
} from "../src/synthia/integrated-tool-factory/integrated-tool-factory.mjs";
import {
	buildThought,
	realize,
} from "../src/synthia/sentenceRealization.mjs";
import { SynthesisRuntime } from "../src/synthia/synthesisRuntime.mjs";

test("integrated factory generates, mounts, and runs a native ATO tool", async () => {
	const factory = new IntegratedToolFactory();
	const mesh = new AutomataMesh();
	const bridge = new ATONativeBridge({ Automaton, mesh, factory });
	const result = bridge.generateAndMount({
		purpose: "orchestrate a local workflow system",
		input: "sense classify build test mount",
		dimension: "Design",
		level: 7,
	});

	assert.equal(result.status, "mounted");
	assert.equal(result.tool.plan.level, 7);
	assert.equal(mesh.automatons.has(result.tool.id), true);

	const run = await bridge.run(
		result.tool.id,
		"sense classify build test mount",
	);
	assert.deepEqual(run.visited, [result.tool.id]);
	assert.equal(
		typeof run.outputs[result.tool.id].output,
		"string",
	);
});

test("Synthia synthesis runtime exposes the end-to-end MVP path", async () => {
	const runtime = new SynthesisRuntime();
	const generated = runtime.synthesize({
		purpose: "build a deterministic grammar rule",
		input: "rule grammar hexagram",
		dimension: "Design",
		level: 5,
	});

	assert.ok(generated.tool);
	assert.equal(generated.tool.levelName, "Hexagram");
	assert.equal(runtime.list().length, 1);

	const run = await runtime.run(generated.tool.id, "alpha beta");
	assert.equal(run.id, generated.tool.id);
	assert.equal(run.visited[0], generated.tool.id);

	const exported = runtime.exportTool(generated.tool.id);
	assert.match(exported.fileName, /\.mjs$/);
	assert.equal(exported.source.includes("import "), false);
});

test("all eight structural synthesis levels are executable", async () => {
	const runtime = new SynthesisRuntime();
	const inputs = [
		"seed",
		0.8,
		[{ color: 1, tone: 1, gate: 1 }],
		["alpha beta", "beta gamma"],
		"alpha beta",
		"alpha beta",
		"packet",
		"sense classify build test mount",
	];

	for (let level = 0; level < 8; level += 1) {
		const generated = runtime.synthesize({
			purpose: `level ${level} smoke tool`,
			input: "local deterministic test",
			dimension: "Design",
			level,
		});
		assert.ok(generated.tool);
		assert.equal(generated.tool.level, level);
		const result = await runtime.run(generated.tool.id, inputs[level]);
		assert.equal(result.visited[0], generated.tool.id);
		assert.notEqual(result.output, undefined);
	}
});

test("semantic completion preserves supplied coordinate fields", () => {
	const completion = new SemanticCompletion({ hiddenDim: 8 });
	const partial = {
		dimension: 2,
		gate: 14,
		line: 3,
	};
	const result = completion.complete(partial);

	assert.equal(result.filled.dimension, partial.dimension);
	assert.equal(result.filled.gate, partial.gate);
	assert.equal(result.filled.line, partial.line);
	assert.equal(result.confidence.dimension, 1);
	assert.equal(result.confidence.gate, 1);
	assert.equal(result.confidence.line, 1);

	for (const layer of TRACE_LAYERS) {
		assert.ok(Number.isInteger(result.filled[layer.name]));
		assert.ok(result.filled[layer.name] >= 0);
		assert.ok(result.filled[layer.name] < layer.k);
	}
});

test("meaning-first sentence realization remains available as an output layer", () => {
	const coord = {
		dimension: 0,
		center: 0,
		gate: 0,
		line: 0,
		color: 0,
		tone: 0,
		base: 0,
		sign: 0,
		house: 0,
	};
	const thought = buildThought(coord);
	const sentence = realize(thought, "scientific");

	assert.match(sentence, /Gate 1/);
	assert.match(sentence, /Aries/);
	assert.match(sentence, /House 1/);
});

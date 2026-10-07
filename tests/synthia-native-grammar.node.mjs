
import assert from "node:assert/strict";
import test from "node:test";

import nativeGrammar, {
	NativeGrammarRuntime,
	PrimitiveLexicon,
} from "../src/synthia/native-grammar/runtime.mjs";
import {
	POSITION_ORDER,
	POSITION_ROLES,
} from "../src/synthia/native-grammar/constants.mjs";
import synthia from "../src/synthia/synthiaRuntime.mjs";

const COMPLETE_ADDRESS = Object.freeze({
	dimension: "Evolution",
	gate: 18,
	line: 1,
	color: 2,
	tone: 3,
	base: 4,
});

test("native grammar exposes exactly 64 primitive slots without inventing unresolved complements", () => {
	const lexicon = new PrimitiveLexicon();
	assert.equal(lexicon.list().length, 64);
	const correction = lexicon.get(18);
	assert.equal(correction.name, "Correction");
	assert.equal(correction.provenance.meaningResolved, true);
	assert.equal(correction.provenance.complementResolved, false);
	assert.deepEqual(correction.complements, []);
});


test("primitive teaching extends the finite basis without changing its 64-slot size", async () => {
	const runtime = new NativeGrammarRuntime();
	const before = runtime.lexicon.list().length;
	const taught = await runtime.run({
		operation: "primitive.teach",
		id: 18,
		patch: {
			aliases: ["repair-pattern"],
			examples: ["A corrected state transition."],
			complements: [58],
			source: "native-grammar-test",
		},
	});
	assert.equal(before, 64);
	assert.equal(runtime.lexicon.list().length, 64);
	assert.equal(runtime.lexicon.find("repair-pattern").id, 18);
	assert.deepEqual(taught.complements, [58]);
	assert.equal(taught.provenance.complementResolved, true);
});

test("P/D/G/L/C/T/B jobs remain invariant across Human Design and code domain labels", async () => {
	const hd = await nativeGrammar.understand("Correction", {
		domain: "human-design",
		address: COMPLETE_ADDRESS,
		remember: false,
	});
	const code = await nativeGrammar.understand("Correction in this component", {
		domain: "code",
		address: COMPLETE_ADDRESS,
		context: {
			component: "state-store",
			language: "javascript",
			state: "reloading",
			behavior: "loses-continuity",
			constraint: "reload",
			inputMode: "runtime-observation",
			runtime: "webview",
		},
		remember: false,
	});

	for (const role of POSITION_ORDER) {
		assert.equal(
			hd.trace[1].value.positions[role].job,
			POSITION_ROLES[role].job,
		);
		assert.equal(
			code.trace[1].value.positions[role].job,
			POSITION_ROLES[role].job,
		);
	}
	assert.notEqual(
		hd.trace[1].value.positions.D.label,
		code.trace[1].value.positions.D.label,
	);
});

test("relationship grammar classifies resonance, harmony, and dissonance and rejects scale teleporting", async () => {
	const result = await nativeGrammar.understand("Correction", {
		address: COMPLETE_ADDRESS,
		relations: [
			{ from: "a", to: "b", type: "same", fromScale: 2, toScale: 2 },
			{ from: "a", to: "c", type: "complement", fromScale: 2, toScale: 2 },
			{ from: "a", to: "d", type: "other", fromScale: 2, toScale: 4 },
		],
		remember: false,
	});
	const relations = result.trace[2].value.relations;
	assert.equal(relations[0].state, "resonance");
	assert.equal(relations[1].state, "harmony");
	assert.equal(relations[2].state, "dissonance");
	assert.equal(relations[0].touchAllowed, true);
	assert.equal(relations[1].touchAllowed, true);
	assert.equal(relations[2].touchAllowed, false);
});

test("scale engine provides the same FOLD/UNFOLD/UP/DOWN/CROSS/PIVOT operators independent of domain", () => {
	const state = { scale: 3, value: "x", components: ["a", "b"] };
	assert.equal(nativeGrammar.scales.operate("UP", state).scale, 4);
	assert.equal(nativeGrammar.scales.operate("DOWN", state).scale, 2);
	assert.equal(
		nativeGrammar.scales.operate("FOLD", state, { members: ["a", "b"] }).value.kind,
		"folded-unit",
	);
	assert.deepEqual(
		nativeGrammar.scales.operate("UNFOLD", state).value,
		["a", "b"],
	);
	assert.equal(
		nativeGrammar.scales.operate("CROSS", state, { counterpart: "y" }).value,
		"y",
	);
	assert.deepEqual(
		nativeGrammar.scales.operate("PIVOT", state, {
			axis: "split-a",
			branches: ["left", "right"],
		}).branches,
		["left", "right"],
	);
});

test("reality correction preserves unresolved as distinct from contradicted and remembers observation", async () => {
	const first = await nativeGrammar.understand("Correction", {
		domain: "human-design",
		address: COMPLETE_ADDRESS,
		observation: null,
		remember: false,
	});
	assert.equal(first.reality.status, "unresolved");

	const supported = await nativeGrammar.understand("Correction", {
		domain: "human-design",
		address: COMPLETE_ADDRESS,
		observation: first.hypothesis,
		remember: true,
	});
	assert.equal(supported.reality.status, "supported");

	const contradicted = nativeGrammar.memory.test(
		{ state: "present", value: 1 },
		{ state: "absent", value: 2 },
	);
	assert.equal(contradicted.status, "contradicted");
});

test("one native control loop handles Human Design, language, and code domains", async () => {
	const inputs = [
		{
			input: "Correction",
			options: {
				domain: "human-design",
				address: COMPLETE_ADDRESS,
			},
		},
		{
			input: "Correction",
			options: {
				domain: "language",
				address: COMPLETE_ADDRESS,
				context: {
					language: "english",
					expression: "utterance",
					constraint: "grammar",
					perception: "text",
					ground: "discourse",
				},
			},
		},
		{
			input: "Correction",
			options: {
				domain: "code",
				address: COMPLETE_ADDRESS,
				context: {
					component: "cache",
					language: "javascript",
					state: "stale",
					behavior: "returns-old-value",
					constraint: "cache-lifetime",
					inputMode: "request",
					runtime: "browser",
				},
			},
		},
	];

	for (const { input, options } of inputs) {
		const result = await nativeGrammar.understand(input, {
			...options,
			remember: false,
		});
		assert.deepEqual(
			result.trace.map((entry) => entry.step),
			["translate", "locate", "relate", "scale", "test", "remember"],
		);
		assert.equal(result.hypothesis.primitive.id, 18);
	}
});

test("live Synthia mesh invokes the addressed native grammar and existing AutoLing boundary", async () => {
	const response = await synthia.process("Correction", {
		surface: "native-grammar-test",
	});
	assert.ok(response.native);
	assert.equal(response.native.version, "synthia.native-understanding.v1");
	assert.equal(response.native.trace[0].step, "translate");
	assert.equal(response.native.trace[0].value.linguistic.status, "resolved");

	const capability = response.mesh.reactions["synthia-native-grammar"];
	assert.equal(capability.status, "observed");
	assert.equal(capability.result.reality.status, "unresolved");
});

test("native grammar and its internal organs are addressed, identified, and live on the integration graph", () => {
	const required = [
		"synthia-native-grammar",
		"synthia-primitive-lexicon",
		"synthia-position-grammar",
		"synthia-relationship-grammar",
		"synthia-scale-engine",
		"synthia-reality-correction",
		"synthia-autoling-adapter",
	];
	for (const id of required) {
		const identity = synthia.selfIntegration.assetGraph.registry.requireReady(id);
		assert.ok(identity.address);
		assert.equal(identity.ready, true);
		assert.equal(synthia.selfIntegration.assetGraph.nodes.has(id), true);
	}
});

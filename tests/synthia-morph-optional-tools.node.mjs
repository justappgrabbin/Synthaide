import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { AutomataMesh } from "../src/synthia/ato-core/automaton.mjs";
import { MorphChatRuntime } from "../src/synthia/morph-chat/runtime.mjs";
import {
	DataEfficientGrammar,
	degGrammarAutomaton,
} from "../src/synthia/deg/grammar.mjs";
import {
	geoDegAutomaton,
} from "../src/synthia/geo-deg/geometry.mjs";

const EXAMPLES = [
	"alpha beta gamma",
	"alpha beta delta",
	"beta gamma epsilon",
];

test("Morph Chat remains usable when optional DEG and Geo-DEG tools are absent", async () => {
	const chat = new MorphChatRuntime();
	const result = await chat.send(
		"Learn a grammar from: alpha beta gamma; alpha beta delta",
	);

	assert.equal(result.meshTools.requested, true);
	assert.equal(result.meshTools.results[0].status, "unavailable");
	assert.match(result.assistant.text, /not currently available/i);
	assert.equal(chat.snapshot().optionalTools.tools.length, 0);
});

test("Morph Chat can discover and call DEG alone through an external tool mesh", async () => {
	const toolMesh = new AutomataMesh();
	toolMesh.add(degGrammarAutomaton());
	const chat = new MorphChatRuntime({ toolMeshes: [toolMesh] });
	const result = await chat.send(
		"Learn a grammar from: alpha beta gamma; alpha beta delta; beta gamma epsilon",
	);

	const learned = result.meshTools.results.find(
		(item) => item.capability === "grammar.learn",
	);
	assert.equal(learned.status, "complete");
	assert.equal(learned.automatonId, "deg-grammar-learner");
	assert.ok(learned.output.ruleCount > 0);
	assert.match(result.assistant.text, /DEG learned/i);
	assert.equal(chat.mesh.automatons.has("deg-grammar-learner"), false);
});

test("Morph Chat can discover Geo-DEG alone without taking ownership of its geometry", async () => {
	const grammar = new DataEfficientGrammar().learn(EXAMPLES, { minSupport: 1 });
	const toolMesh = new AutomataMesh();
	const geo = toolMesh.add(geoDegAutomaton());
	await geo.call({ op: "build", grammar });

	const chat = new MorphChatRuntime();
	chat.attachToolMesh(toolMesh);
	const result = await chat.send("Show me the current Geo-DEG geometry.");

	const snapshot = result.meshTools.results.find(
		(item) => item.capability === "geometry.snapshot",
	);
	assert.equal(snapshot.status, "complete");
	assert.equal(snapshot.automatonId, "geo-deg-grammar-geometry");
	assert.equal(snapshot.output.nodeCount, grammar.ruleCount);
	assert.match(result.assistant.text, /Geo-DEG currently holds/i);
	assert.equal(chat.mesh.automatons.has("geo-deg-grammar-geometry"), false);
});

test("Morph Chat can chain DEG output into Geo-DEG by message data without merging state", async () => {
	const toolMesh = new AutomataMesh();
	const deg = toolMesh.add(degGrammarAutomaton());
	const geo = toolMesh.add(geoDegAutomaton());
	const chat = new MorphChatRuntime({ toolMeshes: [toolMesh] });

	const result = await chat.send(
		"Learn a grammar and build Geo-DEG geometry from: alpha beta gamma; alpha beta delta; beta gamma epsilon",
	);

	const learned = result.meshTools.results.find(
		(item) => item.capability === "grammar.learn",
	);
	const indexed = result.meshTools.results.find(
		(item) => item.capability === "geometry.build",
	);

	assert.equal(learned.status, "complete");
	assert.equal(indexed.status, "complete");
	assert.equal(indexed.output.nodeCount, learned.output.ruleCount);
	assert.notEqual(deg.ownedState, geo.ownedState);
	assert.notEqual(chat.mesh, toolMesh);
	assert.match(result.assistant.text, /DEG learned/i);
	assert.match(result.assistant.text, /Geo-DEG indexed/i);
});

test("Morph runtime has no direct implementation import of DEG or Geo-DEG", () => {
	const runtime = fs.readFileSync(
		new URL("../src/synthia/morph-chat/runtime.mjs", import.meta.url),
		"utf8",
	);
	const broker = fs.readFileSync(
		new URL("../src/synthia/morph-chat/optionalMeshTools.mjs", import.meta.url),
		"utf8",
	);

	assert.doesNotMatch(runtime, /from\s+["'][^"']*(?:deg|geo-deg)\//i);
	assert.doesNotMatch(broker, /from\s+["'][^"']*(?:deg|geo-deg)\//i);
});

test("Residence composition root attaches grammar tools without importing them into Morph", () => {
	const source = fs.readFileSync(
		new URL("../src/pages/welcome/welcome.js", import.meta.url),
		"utf8",
	);
	assert.match(source, /morphChat\.attachToolMesh\(grammarSystems\.mesh\)/);
});

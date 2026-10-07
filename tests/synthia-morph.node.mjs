import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	MorphChatRuntime,
} from "../src/synthia/morph-chat/runtime.mjs";
import {
	LocalMorphProvider,
} from "../src/synthia/morph-chat/providers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

test("Morph Chat is an independent ATO and keeps Klein tools independent", () => {
	const chat = new MorphChatRuntime();
	const snapshot = chat.snapshot();
	const ids = snapshot.mesh.automatons.map((item) => item.id);

	assert.ok(ids.includes("morph-chat"));
	assert.ok(ids.includes("computational-grammar-coder"));
	assert.equal(snapshot.kleinTools.length, 8);
	for (const id of snapshot.kleinTools) {
		assert.ok(ids.includes(id), `${id} should stay independently mounted`);
	}
	for (const id of ["movement", "evolution", "being", "design"]) {
		assert.ok(ids.includes(`perspective-${id}`));
	}
});

test("normal conversation fires a VQ trace and returns non-echo language", async () => {
	const chat = new MorphChatRuntime();
	const result = await chat.send("Hello, can we talk about what I am building?");

	assert.equal(result.trace.bound, "morph-chat");
	assert.equal(result.trace.activated, true);
	assert.equal(typeof result.trace.id, "number");
	assert.ok(result.trace.completion?.filled);
	assert.notEqual(result.assistant.text, result.user.text);
	assert.ok(result.assistant.text.length > 20);
	assert.equal(chat.snapshot().phase, "IDLE");
});

test("perspective is proportional and plural rather than one fixed view", async () => {
	const chat = new MorphChatRuntime();
	const first = await chat.send("Write JavaScript code and verify the architecture with tests.");
	const second = await chat.send("Remember our earlier idea and how it has changed over time.");

	for (const result of [first, second]) {
		const weights = result.perspective.dimensions.map((item) => item.weight);
		const total = weights.reduce((sum, value) => sum + value, 0);
		assert.ok(Math.abs(total - 1) < 1e-9);
		assert.ok(weights.filter((value) => value > 0).length > 1);
	}
	const firstById = Object.fromEntries(first.perspective.dimensions.map((item) => [item.id, item.weight]));
	const secondById = Object.fromEntries(second.perspective.dimensions.map((item) => [item.id, item.weight]));
	assert.notDeepEqual(firstById, secondById);
	assert.ok(first.perspective.aspects.length >= 4);
	assert.equal(first.perspective.integration.id, "space");
	assert.equal(first.perspective.integration.contributingPeer, false);
});

test("coding conversation produces executable-oriented code and grammar analysis", async () => {
	const chat = new MorphChatRuntime();
	const result = await chat.send("Write JavaScript code to add two numbers and explain it normally.");

	assert.equal(result.semantic.intent, "code");
	assert.ok(result.codeAnalysis);
	assert.match(result.assistant.text, /```javascript/);
	assert.match(result.assistant.text, /function add/);
});

test("multi-turn session memory is carried into later responses", async () => {
	const chat = new MorphChatRuntime();
	await chat.send("My project has an independent blue automaton.");
	const result = await chat.send("Remember what I told you earlier.");

	assert.equal(chat.snapshot().messages.length, 4);
	assert.equal(result.semantic.intent, "memory");
	assert.match(result.assistant.text, /prior user turn/i);
	assert.match(result.assistant.text, /independent blue automaton/i);
});

test("final wording provider is replaceable without replacing Morph cognition", async () => {
	class FakeProvider {
		constructor() {
			this.id = "fake-model";
		}
		async generate(context) {
			assert.ok(context.trace.activated);
			assert.ok(context.perspective.dimensions.length > 1);
			return `MODEL:${context.semantic.focus}`;
		}
	}

	const chat = new MorphChatRuntime({ provider: new FakeProvider() });
	const result = await chat.send("How should this system connect?");
	assert.equal(result.provider, "fake-model");
	assert.match(result.assistant.text, /^MODEL:/);
});

test("provider failure falls back to the local Morph realization", async () => {
	class FailingProvider {
		constructor() {
			this.id = "offline-provider";
		}
		async generate() {
			throw new Error("offline");
		}
	}
	const chat = new MorphChatRuntime({ provider: new FailingProvider() });
	const result = await chat.send("Hello.");
	assert.equal(result.provider, "local-morph");
	assert.equal(result.fallback, true);
	assert.ok(result.assistant.text.length > 10);
});

test("Residence UI exposes separate Morph and Morph Chat routes with cached panels", () => {
	const source = fs.readFileSync(
		path.join(projectRoot, "src/pages/welcome/welcome.js"),
		"utf8",
	);
	assert.match(source, /import morphChat from "synthia\/morph-chat\/runtime\.mjs"/);
	assert.match(source, /import visualMorph from "synthia\/morph-engine\/runtime\.mjs"/);
	assert.match(source, /\["morph", "Morph"\]/);
	assert.match(source, /\["morph-chat", "Morph Chat"\]/);
	assert.match(source, /const panels = new Map\(\)/);
	assert.match(source, /function Morph\(\)/);
	assert.match(source, /function MorphChat\(\)/);
	assert.match(source, /function Settings\(show\)/);
	assert.match(source, /panels\.set\(activePanel, factory\(\)\)/);
});

test("user-supplied visual Morph Engine remains standalone behind the shell bridge", () => {
	const donor = fs.readFileSync(
		path.join(projectRoot, "src/synthia/morph-engine/morph-engine.js"),
		"utf8",
	);
	const bridge = fs.readFileSync(
		path.join(projectRoot, "src/synthia/morph-engine/runtime.mjs"),
		"utf8",
	);
	assert.match(donor, /root\.MorphEngineLib = api/);
	assert.match(donor, /PoseMatcher/);
	assert.match(donor, /TransitionEdge/);
	assert.match(bridge, /globalThis\.MorphEngineLib/);
	assert.match(bridge, /this\.engine\.morph/);
});

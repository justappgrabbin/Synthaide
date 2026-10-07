
import test from "node:test";
import assert from "node:assert/strict";

import canonicalState from "../src/synthia/canonicalState.mjs";
import { ComponentRegistry } from "../src/synthia/identity/componentRegistry.mjs";
import { LivingMeshRuntime } from "../src/synthia/livingMeshRuntime.mjs";
import { SelfIntegrationRuntime } from "../src/synthia/assembly/selfIntegrationRuntime.mjs";
import { MorphChangeRuntime } from "../src/synthia/morph-engine/changeRuntime.mjs";

const ADDRESS_FIELDS = [
	"planetary",
	"dimension",
	"gate",
	"line",
	"color",
	"tone",
	"base",
	"degree",
	"minute",
	"second",
	"arcAxis",
	"zodiac",
	"house",
];

test("component intake addresses first and distinguishes checked-empty from unresolved", () => {
	const registry = new ComponentRegistry({ addressAuthority: canonicalState });
	const ready = registry.identify({
		id: "example-ready",
		name: "Example Ready",
		kind: "component",
		what: { capabilities: [] },
		why: "Test identity completeness.",
		how: { mechanism: "fixture" },
		relationships: [],
		behaviors: [],
		dependencies: [],
		when: { activation: "test" },
		provenance: { source: "test" },
	});
	assert.equal(ready.ready, true);
	assert.deepEqual(ready.relationships.value, []);
	assert.equal(ready.relationships.status, "checked");
	assert.deepEqual(ready.intakeOrder.slice(0, 2), ["address", "who"]);
	for (const field of ADDRESS_FIELDS) {
		assert.notEqual(ready.address[field], undefined);
	}

	const unresolved = registry.identify({
		id: "example-unresolved",
		name: "Example Unresolved",
		kind: "component",
		what: { capabilities: [] },
		why: "Test unresolved identity.",
		how: { mechanism: "fixture" },
		relationships: [],
		behaviors: [],
		// dependencies intentionally omitted
		when: { activation: "test" },
		provenance: { source: "test" },
	});
	assert.equal(unresolved.ready, false);
	assert.equal(unresolved.dependencies.status, "unresolved");
	assert.ok(unresolved.unresolved.includes("dependencies"));
});

test("Asset Graph detects a missing relationship and clears it when connected", () => {
	const mesh = new LivingMeshRuntime();
	const runtime = new SelfIntegrationRuntime({ meshRuntime: mesh });

	runtime.registerEntity({
		id: "person:maker",
		name: "Maker",
		kind: "person",
		capabilities: ["build"],
		why: "Can build a thing.",
		how: { interface: "person" },
		relationships: [],
		behaviors: ["builds"],
		dependencies: [],
		when: { activation: "collaboration" },
		provenance: { source: "test" },
	});
	runtime.registerEntity({
		id: "thing:prototype",
		name: "Prototype",
		kind: "thing",
		capabilities: [],
		why: "Needs to be built.",
		how: { interface: "artifact" },
		relationships: [],
		behaviors: [],
		dependencies: [],
		when: { activation: "project" },
		provenance: { source: "test" },
	});

	runtime.assetGraph.expect("person:maker", "thing:prototype", {
		type: "builds",
		projection: "causal",
		reason: "Maker is expected to build the prototype.",
	});
	const before = runtime.detect();
	assert.equal(before.count, 1);
	assert.equal(before.gaps[0].kind, "missing-relationship");

	runtime.assetGraph.connect("person:maker", "thing:prototype", {
		type: "builds",
		projection: "causal",
		evidence: "test-connection",
	});
	const after = runtime.detect();
	assert.equal(after.count, 0);
});

test("people, places, and things learn relationship resonance without sharing private state", () => {
	const mesh = new LivingMeshRuntime();
	const runtime = new SelfIntegrationRuntime({ meshRuntime: mesh });

	for (const entity of [
		{
			id: "person:alex",
			name: "Alex",
			kind: "person",
			capabilities: ["repair"],
			public: { interest: "bicycles" },
		},
		{
			id: "place:workshop",
			name: "Workshop",
			kind: "place",
			capabilities: ["workspace"],
			public: { category: "workshop" },
		},
		{
			id: "thing:bicycle",
			name: "Bicycle",
			kind: "thing",
			capabilities: [],
			public: { category: "bicycle" },
		},
	]) {
		runtime.registerEntity({
			...entity,
			why: "Resonance relationship fixture.",
			how: { interface: "resonance-entity" },
			relationships: [],
			behaviors: [],
			dependencies: [],
			when: { activation: "test" },
			provenance: { source: "test" },
			private: { secret: "must-not-be-shared" },
		});
	}

	runtime.resonance.relate({
		from: "person:alex",
		to: "thing:bicycle",
		type: "repairs",
		projection: "phase",
		outcome: 1,
		evidence: "repair-outcome-1",
		verified: true,
	});
	runtime.resonance.relate({
		from: "person:alex",
		to: "place:workshop",
		type: "works-at",
		projection: "phase",
		outcome: 0.8,
		evidence: "work-outcome-1",
		verified: true,
	});

	const neighbors = runtime.resonance.neighbors("person:alex");
	assert.equal(neighbors.length, 2);
	assert.ok(neighbors.every((item) => item.observations >= 1));
	const snapshot = runtime.resonance.snapshot();
	assert.equal(JSON.stringify(snapshot).includes("must-not-be-shared"), false);
});

test("Morph change path requires sandboxed suggestion approval before apply", async () => {
	const runtime = new MorphChangeRuntime();
	const assets = [{
		name: "module.mjs",
		type: "text/javascript",
		kind: "code",
		text: "const helper = () => 1;\nexport function value(){ return helper(); }\n",
	}];

	const suggestion = await runtime.propose({
		assets,
		intent: {
			rewrite: { rename: { helper: "utility" } },
			prompt: "rename helper to utility",
		},
		meta: {
			title: "Rename helper",
			why: "Exercise the quarantined AST change path.",
		},
	});
	assert.equal(suggestion.status, "pending");
	assert.equal(suggestion.verification.passed, true);
	await assert.rejects(() => runtime.apply(suggestion.id, { assets }), /Approval required/);

	runtime.inbox.approve(suggestion.id, "test approval");
	const applied = await runtime.apply(suggestion.id, { assets });
	assert.equal(applied.status, "applied");
	assert.match(applied.installResult[0].text, /utility/);
	assert.doesNotMatch(applied.installResult[0].text, /\bhelper\b/);
});

test("Idle Suggestion Scout stops at the inbox", async () => {
	const runtime = new MorphChangeRuntime();
	const assets = [{
		name: "idle.mjs",
		text: "const oldLabel = 'old';\nexport const label = oldLabel;\n",
	}];
	runtime.configure({
		getAssets: async () => assets,
		getIntents: async () => [{
			intent: {
				prompt: "rename oldLabel to currentLabel",
				rewrite: { rename: { oldLabel: "currentLabel" } },
			},
			meta: { title: "Idle rename" },
		}],
		isIdle: () => true,
	});
	const suggestion = await runtime.scout.tick();
	assert.equal(suggestion.status, "pending");
	assert.equal(runtime.inbox.list({ status: "applied" }).length, 0);
});

test("the app source contains no donor warehouse or restored donor tree", async () => {
	const fs = await import("node:fs");
	const path = await import("node:path");
	const root = path.resolve(new URL("..", import.meta.url).pathname);
	assert.equal(fs.existsSync(path.join(root, "synthia-donors")), false);
	assert.equal(fs.existsSync(path.join(root, "synthia-donor-tests")), false);
	assert.equal(
		fs.existsSync(path.join(root, "src", "synthia", "restored-systems")),
		false,
	);
});

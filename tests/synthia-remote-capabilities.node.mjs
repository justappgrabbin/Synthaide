import assert from "node:assert/strict";
import test from "node:test";

import { CapabilityBody } from "../src/synthia/embodiment/capabilityBody.mjs";
import CapabilityCatalog from "../src/synthia/remote/CapabilityCatalog.mjs";
import { RemoteCapabilityRuntime } from "../src/synthia/remote/RemoteCapabilityRuntime.mjs";
import { MemoryCapabilityCatalogStore } from "../src/synthia/remote/CapabilityCatalogStore.mjs";
import TransitionResolver from "../src/synthia/resolver/TransitionResolver.mjs";

const entry = {
	id: "remote-button-tool",
	address: { mode: "macro", gate: 7, line: 1, color: 1, tone: 1, base: 1 },
	url: "https://example.test/remote-button-tool.mjs",
	sha256: "a".repeat(64),
	capabilities: ["button.remote"],
	transition: { accepts: ["button-present"], produces: ["button-pressed"] },
	contracts: { exports: ["manifest", "agree", "execute"] },
};

test("catalog resolves one artifact by address, capability, or transition output", () => {
	const catalog = new CapabilityCatalog();
	const registered = catalog.register(entry);
	assert.equal(catalog.resolve({ address: registered.address })[0].id, entry.id);
	assert.equal(catalog.resolve({ capability: "button.remote" })[0].id, entry.id);
	assert.equal(catalog.resolve({ produces: "button-pressed" })[0].id, entry.id);
});

test("remote materialization requires verification and Morph agreement before activation", async () => {
	const body = new CapabilityBody();
	let invited = 0;
	const runtime = new RemoteCapabilityRuntime({
		body,
		retrieve: async () => ({
			status: "completed",
			output: { verified: true, bytes: new TextEncoder().encode("export const ok=true").buffer },
		}),
		sandbox: { verify: async () => ({ passed: true }) },
		morphInvite: async () => { invited += 1; return { agreed: true }; },
		loadModule: async () => ({
			manifest: { id: entry.id },
			agree: (task) => ({ agreed: task.allowed === true }),
			execute: () => "done",
		}),
	});
	runtime.register(entry);
	const result = await runtime.materialize(entry.id, {
		activation: {
			resonance: 0.9,
			expression: "interaction",
			evidence: { type: "goal", goal: "press the remote button" },
		},
	});
	assert.equal(result.status, "activated-by-resonance");
	assert.equal(invited, 1);
	assert.equal(body.snapshot().activeActionToolCount, 1);
	assert.equal((await body.request(entry.id, { allowed: false })).status, "declined");
	assert.equal((await body.request(entry.id, { allowed: true })).output, "done");
});

test("a verified download remains inactive when Morph declines", async () => {
	const body = new CapabilityBody();
	const runtime = new RemoteCapabilityRuntime({
		body,
		retrieve: async () => ({ status: "completed", output: { verified: true, bytes: new ArrayBuffer(0) } }),
		sandbox: { verify: async () => ({ passed: true }) },
		morphInvite: async () => ({ agreed: false, reason: "NOT_COMPATIBLE" }),
		loadModule: async () => assert.fail("declined modules must not load"),
	});
	runtime.register(entry);
	const result = await runtime.materialize(entry.id);
	assert.equal(result.status, "morph-declined");
	assert.equal(body.components.has(entry.id), false);
});

test("catalog survives a fresh runtime through its local store", () => {
	const store = new MemoryCapabilityCatalogStore();
	new CapabilityCatalog({ store }).register(entry);
	const restored = new CapabilityCatalog({ store });
	restored.hydrate();
	assert.equal(restored.resolve({ produces: "button-pressed" })[0].id, entry.id);
});

test("remote transition output is wired into the main resolver and executes sovereignly", async () => {
	const body = new CapabilityBody();
	const transitionResolver = new TransitionResolver();
	const runtime = new RemoteCapabilityRuntime({
		body,
		transitionResolver,
		retrieve: async () => ({
			status: "completed",
			output: { verified: true, bytes: new TextEncoder().encode("export const ok=true").buffer },
		}),
		sandbox: { verify: async () => ({ passed: true }) },
		morphInvite: async () => ({ agreed: true }),
		loadModule: async () => ({
			manifest: { id: entry.id },
			agree: () => ({ agreed: true }),
			execute: () => ({ state: ["button-present", "button-pressed"] }),
		}),
	});
	runtime.register(entry);
	const result = await runtime.solve(["button-present"], ["button-pressed"], {
		activation: {
			resonance: 0.9,
			expression: "interaction",
			evidence: { type: "goal", goal: "button-pressed" },
		},
	});
	assert.equal(result.status, "solved");
	assert.equal(result.executions[0].componentId, entry.id);
});

test("resonance recomposes the field instead of queuing a 27th tool", async () => {
	const body = new CapabilityBody();
	for (let index = 0; index < 26; index += 1) {
		body.register({
			id: `resident-${index}`,
			kind: "action",
			capabilities: [`resident.${index}`],
			agree: () => true,
			execute: () => null,
			active: true,
		});
	}
	const runtime = new RemoteCapabilityRuntime({
		body,
		retrieve: async () => ({ status: "completed", output: { verified: true, bytes: "export {}" } }),
		sandbox: { verify: async () => ({ passed: true }) },
		morphInvite: async () => ({ agreed: true }),
		loadModule: async () => ({ manifest: { id: entry.id }, agree: () => true, execute: () => null }),
	});
	runtime.register(entry);
	const field = Array.from({ length: 26 }, (_, index) => ({
		id: `resident-${index}`,
		resonance: 0.1 + index / 100,
		expression: "resident-action",
		evidence: { type: "path", step: index },
	}));
	field.push({
		id: entry.id,
		resonance: 1,
		expression: "game",
		evidence: { type: "purpose", purpose: "current user goal" },
	});
	const result = await runtime.materialize(entry.id, { activation: { field } });
	assert.equal(result.status, "activated-by-resonance");
	assert.equal(body.components.has(entry.id), true);
	assert.equal(body.activeActionTools.has(entry.id), true);
	assert.equal(body.activeActionTools.size, 26);
	assert.equal(body.activeActionTools.has("resident-0"), false);
});

test("a goal may express a sparse mixed field without filling 26 positions", () => {
	const body = new CapabilityBody();
	for (const id of ["game-maker", "design-hand", "animator"]) {
		body.register({ id, kind: "action", agree: () => true, execute: () => null });
	}
	const expression = body.selectByResonance([
		{
			id: "animator",
			resonance: 0.84,
			expression: "animation",
			evidence: { type: "goal", goal: "make the character move" },
		},
	]);
	assert.deepEqual(expression.active.map((signal) => signal.id), ["animator"]);
	assert.equal(body.activeActionTools.size, 1);
});

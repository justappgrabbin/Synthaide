import assert from "node:assert/strict";
import test from "node:test";

import { CapabilityBody, CapabilityBodyError } from "../src/synthia/embodiment/capabilityBody.mjs";
import { EmbodimentRuntime } from "../src/synthia/embodiment/embodimentRuntime.mjs";

test("only active action tools consume the 26 body slots", () => {
	const body = new CapabilityBody();
	for (const kind of ["mind", "heart", "direction", "social"]) {
		body.register({ id: kind, kind, capabilities: [kind], agree: () => true });
	}
	for (let index = 1; index <= 26; index += 1) {
		body.register({
			id: `action-${index}`,
			kind: "action",
			capabilities: ["act"],
			agree: () => true,
			execute: () => index,
			active: true,
		});
	}
	assert.equal(body.snapshot().activeActionToolCount, 26);
	assert.equal(body.snapshot().components.length, 30);
	assert.throws(
		() => body.register({
			id: "action-27",
			kind: "action",
			agree: () => true,
			execute: () => null,
			active: true,
		}),
		(error) => error instanceof CapabilityBodyError && error.code === "ACTION_TOOL_CEILING",
	);
});

test("a capable sovereign tool can decline without executing", async () => {
	let executions = 0;
	const body = new CapabilityBody();
	body.register({
		id: "hands",
		kind: "action",
		capabilities: ["button.press"],
		agree: () => ({ agreed: false, reason: "NOT_MY_TASK" }),
		execute: () => { executions += 1; },
		active: true,
	});
	const result = await body.request("hands", { action: "press" });
	assert.equal(result.status, "declined");
	assert.equal(result.reason, "NOT_MY_TASK");
	assert.equal(executions, 0);
});

test("hands do not imply that the browser host is available", async () => {
	const runtime = new EmbodimentRuntime();
	runtime.bindHost({
		id: "browser",
		capabilities: ["browser.navigate"],
		available: () => false,
		permitted: () => true,
		execute: () => assert.fail("unavailable browser must not execute"),
	});
	const result = await runtime.request("browser", { url: "https://example.test" });
	assert.equal(result.status, "declined");
	assert.equal(result.reason, "HOST_CAPABILITY_UNAVAILABLE");
});

test("an available host still needs per-task permission", async () => {
	let executions = 0;
	const runtime = new EmbodimentRuntime();
	runtime.bindHost({
		id: "hands",
		capabilities: ["button.press"],
		available: () => true,
		permitted: (_operation, task) => task.target === "allowed",
		execute: () => { executions += 1; return "pressed"; },
	});
	assert.equal((await runtime.request("hands", { target: "blocked" })).status, "declined");
	assert.equal((await runtime.request("hands", { target: "allowed" })).status, "completed");
	assert.equal(executions, 1);
});


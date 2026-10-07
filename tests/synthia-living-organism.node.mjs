import test from "node:test";
import assert from "node:assert/strict";
import { LivingOrganismRuntime } from "../src/synthia/organism/livingOrganismRuntime.mjs";

test("organism cognition is bounded independently from render frames", () => {
	const organism = new LivingOrganismRuntime({ pulseMs: 250 });
	assert.equal(organism.pulse(1000).pulsed, true);
	assert.equal(organism.pulse(1016).pulsed, false);
	assert.equal(organism.pulse(1250).pulsed, true);
	assert.equal(organism.snapshot().generation, 2);
});

test("pending approval is a hard decision stop and cannot be overwritten", () => {
	const organism = new LivingOrganismRuntime({ autonomy: 0 });
	organism.propose({ id: "first", description: "First action" });
	organism.propose({ id: "second", description: "Second action" });
	organism.pulse(1000);
	assert.equal(organism.snapshot().pendingApproval.id, "first");
	organism.pulse(1250);
	assert.equal(organism.snapshot().pendingApproval.id, "first");
	assert.equal(organism.snapshot().queue.length, 1);
});

test("duplicate action proposals do not multiply the queue", () => {
	const organism = new LivingOrganismRuntime();
	assert.equal(organism.propose({ description: "Inspect artifact" }).status, "queued");
	assert.equal(organism.propose({ description: "Inspect artifact" }).status, "duplicate");
	assert.equal(organism.snapshot().queue.length, 1);
});

test("approval activates exactly one action and consumes energy once", () => {
	const organism = new LivingOrganismRuntime({ autonomy: 0 });
	organism.propose({ id: "safe", description: "Run verified change", cost: 0.2 });
	organism.pulse(1000);
	const before = organism.snapshot().metabolism.energy;
	organism.approve();
	const after = organism.snapshot();
	assert.equal(after.currentAction.id, "safe");
	assert.equal(after.pendingApproval, null);
	assert.ok(after.metabolism.energy < before);
	organism.pulse(1250);
	assert.equal(organism.snapshot().currentAction.id, "safe");
	assert.ok(organism.snapshot().metabolism.energy >= after.metabolism.energy);
});

test("episodic memory is bounded and retains structured gate evidence", () => {
	const organism = new LivingOrganismRuntime({ memoryCapacity: 2 });
	organism.remember({ context: "one", gates: [1, 64, 99] });
	organism.remember({ context: "two" });
	organism.remember({ context: "three" });
	const episodes = organism.snapshot().episodes;
	assert.deepEqual(episodes.map(x => x.context), ["two", "three"]);
});

import test from "node:test";
import assert from "node:assert/strict";

import { VQTriggerLab, traceCueFromAddress } from "../src/synthia/vqTriggerLab.mjs";
import synthesis from "../src/synthia/synthesisRuntime.mjs";

function cue(overrides = {}) {
	return traceCueFromAddress({
		dimension: "Being",
		gate: 29,
		line: 1,
		color: 1,
		tone: 1,
		base: 1,
		zodiac: "Leo",
		house: 5,
	}, {
		purpose: "make a tiny echo transform for VQ trace testing",
		input: "vqvae-test",
		toolDimension: "Being",
		toolLevel: 0,
		...overrides,
	});
}

test("VQ-VAE + semantic completion remains a tiny firing identity model", () => {
	const lab = new VQTriggerLab();
	const footprint = lab.footprint();
	assert.equal(footprint.traceLayers, 9);
	assert.equal(footprint.codebookSize, 32);
	assert.equal(footprint.latentDim, 24);
	assert.ok(footprint.parameters < 40000);
	assert.ok(footprint.float64Bytes < 320 * 1024);
});

test("unlearned traces remain sparse and fire nothing", async () => {
	const lab = new VQTriggerLab();
	const fired = await lab.fire(cue());
	assert.equal(fired.activated, false);
	assert.equal(fired.automatonId, null);
	assert.equal(fired.circuitResult, null);
	assert.equal(fired.completion, null);
});

test("a learned VQ trace activates the bound ATO and reaches Tool Factory", async () => {
	const lab = new VQTriggerLab();
	const request = cue();
	const learned = lab.learnToolCue(request);
	const fired = await lab.fire(request);

	assert.equal(fired.activated, true);
	assert.equal(fired.trace, learned.trace);
	assert.equal(fired.automatonId, "vq-tool-synthesis");
	assert.ok(fired.circuitResult?.tool?.id);
	assert.equal(synthesis.mesh.automatons.has(fired.circuitResult.tool.id), true);
});

test("semantic completion preserves every known coordinate exactly", async () => {
	const lab = new VQTriggerLab();
	const request = cue();
	lab.learnToolCue(request);
	const fired = await lab.fire(request);

	for (const field of ["dimension", "gate", "line", "color", "tone", "base", "sign", "house"]) {
		assert.equal(fired.completion.filled[field], request[field], field);
		assert.equal(fired.completion.confidence[field], 1, field);
	}
	assert.ok(Number.isInteger(fired.completion.filled.center));
	assert.ok(fired.completion.filled.center >= 0 && fired.completion.filled.center < 9);
});

test("the synthesized tool produced by trace activation is executable", async () => {
	const lab = new VQTriggerLab();
	const request = cue({ purpose: "make a reversible compact text transform" });
	lab.learnToolCue(request);
	const fired = await lab.fire(request);
	const toolId = fired.circuitResult.tool.id;
	const result = await synthesis.run(toolId, "hello");

	assert.equal(result.id, toolId);
	assert.ok(result.output !== undefined);
	assert.ok(result.visited.includes(toolId));
});

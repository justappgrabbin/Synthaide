import test from "node:test";
import assert from "node:assert/strict";
import { calculateBiorhythm, simulateReaction, evolveCodonState, normalizeHumanDesignChart, sourceById } from "../src/synthia/labs/index.mjs";

test("biorhythm cycles are deterministic and explicitly non-predictive", () => {
	const a = calculateBiorhythm("1999-09-18T00:00:00Z", "2026-09-01T00:00:00Z");
	const b = calculateBiorhythm("1999-09-18T00:00:00Z", "2026-09-01T00:00:00Z");
	assert.deepEqual(a, b); assert.equal(a.predictiveClaim, false);
});

test("chemistry engine resolves verified mixtures and preserves unknowns", () => {
	assert.equal(simulateReaction(["NaOH", "HCl"], { temperatureC: 20 }).equation, "HCl + NaOH -> NaCl + H2O");
	assert.equal(simulateReaction(["H2O", "NaCl"]).matched, false);
});

test("codon OU experiment is reproducible with injected randomness", () => {
	const result = evolveCodonState({ codons: ["ATG", "GCT"], fitness: 1, optimum: 0, rng: () => 0.5 });
	assert.equal(result.model, "ornstein-uhlenbeck-selection"); assert.equal(result.codons.length, 2); assert.ok(Number.isFinite(result.fitness));
});

test("Human Design bridge keeps calculation facts separate from provider", () => {
	const result = normalizeHumanDesignChart("human-design-reader", { foundations: { type: "Generator", authority: "Sacral" }, channels: ["34-20"] });
	assert.equal(result.facts.type, "Generator"); assert.deepEqual(result.channels, ["34-20"]);
});

test("restricted sources cannot masquerade as incorporated engines", () => {
	assert.equal(sourceById("eldermind").incorporation, "blocked-without-written-permission");
});

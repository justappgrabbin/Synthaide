import test from "node:test";
import assert from "node:assert/strict";

import { CanonicalStateAuthority } from "../src/synthia/canonicalState.mjs";
import TransitionDescriptor from "../src/synthia/resolver/TransitionDescriptor.mjs";
import AddressSubstrateCalculator from "../src/synthia/resolver/AddressSubstrateCalculator.mjs";

test("Gate -> Line -> Color -> Tone -> Base feeds existing Klein calculations into five-substrate transition math", () => {
	const authority = new CanonicalStateAuthority();
	const source = authority.resolve("understand and repair a missing interface");
	const target = {
		...source,
		gate: source.gate === 64 ? 1 : source.gate + 1,
		line: source.line === 6 ? 1 : source.line + 1,
		color: source.color === 6 ? 1 : source.color + 1,
		tone: source.tone === 6 ? 1 : source.tone + 1,
		base: source.base === 5 ? 1 : source.base + 1,
	};

	const candidate = new TransitionDescriptor({
		componentId: "addressed-repair",
		address: target,
		accepts: ["addressed"],
		produces: ["repaired"],
	});

	const calculation = new AddressSubstrateCalculator().calculate({
		current: ["addressed"],
		desired: ["repaired"],
		address: source,
		candidate,
		context: { source: "klein-address-test" },
	});

	assert.deepEqual(
		calculation.klein.nested.order,
		["gate", "line", "color", "tone", "base"],
	);
	assert.equal(calculation.klein.source.gate.number, source.gate);
	assert.equal(calculation.klein.source.line.number, source.line);
	assert.equal(calculation.klein.source.color, source.color);
	assert.equal(calculation.klein.source.tone, source.tone);
	assert.equal(calculation.klein.source.base, source.base);
	assert.equal(calculation.klein.source.vector.length, 24);
	assert.equal(calculation.klein.transition.vectorOperator.length, 24);
	assert.equal(
		calculation.klein.transition.gateChangingLines.length,
		calculation.klein.transition.gateDistance,
	);
	assert.equal(calculation.klein.transition.kleinHouseTransformValid, true);
	assert.deepEqual(
		calculation.projections.b.meaning.klein,
		calculation.klein.source,
	);
	assert.deepEqual(
		calculation.projections.s.resolvedRelation.klein,
		calculation.klein.transition,
	);

	const repeat = new AddressSubstrateCalculator().calculate({
		current: ["addressed"],
		desired: ["repaired"],
		address: source,
		candidate,
		context: { source: "klein-address-test" },
	});
	assert.deepEqual(calculation, repeat);
});

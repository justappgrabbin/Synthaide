import test from "node:test";
import assert from "node:assert/strict";

import { CanonicalStateAuthority } from "../src/synthia/canonicalState.mjs";
import TransitionIndex from "../src/synthia/resolver/TransitionIndex.mjs";
import TransitionResolver from "../src/synthia/resolver/TransitionResolver.mjs";
import TransitionDescriptor from "../src/synthia/resolver/TransitionDescriptor.mjs";
import AddressSubstrateCalculator from "../src/synthia/resolver/AddressSubstrateCalculator.mjs";

test("canonical address selects a five-substrate calculation before transition execution", async () => {
	const authority = new CanonicalStateAuthority();
	const currentAddress = authority.resolve("repair the missing interface");

	const sameAddress = new TransitionDescriptor({
		componentId: "same-address-capability",
		address: currentAddress,
		accepts: ["addressed"],
		produces: ["executable"],
	});

	const distantAddress = new TransitionDescriptor({
		componentId: "distant-capability",
		address: {
			...currentAddress,
			gate: currentAddress.gate === 64 ? 1 : currentAddress.gate + 1,
			line: currentAddress.line === 6 ? 1 : currentAddress.line + 1,
		},
		accepts: ["addressed"],
		produces: ["executable"],
	});

	const index = new TransitionIndex();
	index.register(distantAddress);
	index.register(sameAddress);

	let activationPayload = null;
	const resolver = new TransitionResolver({
		index,
		calculator: new AddressSubstrateCalculator(),
		activate: async (descriptor, payload) => {
			activationPayload = { descriptor, payload };
			return { state: ["addressed", "executable"] };
		},
	});

	const resolution = resolver.resolve(
		["addressed"],
		["executable"],
		{ address: currentAddress },
	);

	assert.equal(resolution.status, "candidate-found");
	assert.equal(resolution.selected.descriptor.componentId, "same-address-capability");
	assert.equal(resolution.selected.calculation.primarySubstrate, currentAddress.dimension);
	assert.equal(resolution.selected.calculation.permitted, true);
	assert.equal(resolution.selected.calculation.addressAffinity, 1);
	assert.ok(resolution.selected.calculation.projections.mu);
	assert.ok(resolution.selected.calculation.projections.e);
	assert.ok(resolution.selected.calculation.projections.b);
	assert.ok(resolution.selected.calculation.projections.d);
	assert.ok(resolution.selected.calculation.projections.s);

	const plan = resolver.plan(
		["addressed"],
		["executable"],
		{ address: currentAddress },
	);
	assert.equal(plan.status, "planned");
	assert.equal(plan.steps[0].calculation.primarySubstrate, currentAddress.dimension);

	const solved = await resolver.solve(
		["addressed"],
		["executable"],
		{ address: currentAddress },
	);
	assert.equal(solved.status, "solved");
	assert.equal(
		activationPayload.payload.calculation.primarySubstrate,
		currentAddress.dimension,
	);
	assert.deepEqual(
		activationPayload.payload.address,
		currentAddress,
	);
});

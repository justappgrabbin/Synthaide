import test from "node:test";
import assert from "node:assert/strict";

import synthia from "../src/synthia/synthiaRuntime.mjs";
import canonicalState from "../src/synthia/canonicalState.mjs";

test("real problem: address -> five substrates + Klein -> resolve -> synthesize tool -> verify", async () => {
	const problem = "Create an executable tool that inspects gate-address relationships.";
	const current = ["addressed", "capability-required"];
	const desired = ["executable"];

	// ADDRESS
	const address = canonicalState.resolve(problem);

	// CALCULATE + RESOLVE
	const resolver = synthia.selfIntegration.transitionResolver;
	const resolution = resolver.resolve(current, desired, {
		address,
		context: {
			problem,
			source: "real-problem-proof",
		},
	});
	assert.equal(resolution.status, "candidate-found");
	assert.equal(
		resolution.selected.descriptor.componentId,
		"synthia-tool-synthesis-worker",
	);

	const calculation = resolution.selected.calculation;
	assert.ok(calculation);
	assert.ok(calculation.klein);
	assert.equal(calculation.klein.source.gate.number, address.gate);
	assert.equal(calculation.klein.source.line.number, address.line);
	assert.equal(calculation.klein.source.color, address.color);
	assert.equal(calculation.klein.source.tone, address.tone);
	assert.equal(calculation.klein.source.base, address.base);

	// ACT through the already-mounted real synthesis worker.
	const action = await synthia.meshRuntime.invoke(
		"synthia-tool-synthesis-worker",
		{
			op: "synthesize",
			purpose: problem,
			input: problem,
			dimension: address.dimension,
		},
		{
			context: {
				source: "real-problem-proof",
				address,
				calculation,
			},
		},
	);
	assert.ok(action?.tool?.id);
	assert.ok(["mounted", "existing"].includes(action.status));

	// VERIFY the observed outcome against the resolver's desired state.
	const after = [...current, "executable"];
	const verification = resolver.verifier.compare({
		before: current,
		after,
		desired,
		evidence: [{
			type: "real-tool-synthesis",
			toolId: action.tool.id,
			addressKey: action.tool.addressKey,
			status: action.status,
		}],
	});
	assert.equal(verification.status, "supported");

	console.log(JSON.stringify({
		problem,
		address,
		calculation: {
			primarySubstrate: calculation.primarySubstrate,
			klein: {
				source: {
					gate: calculation.klein.source.gate,
					line: calculation.klein.source.line,
					color: calculation.klein.source.color,
					tone: calculation.klein.source.tone,
					base: calculation.klein.source.base,
					kleinHouse: calculation.klein.source.kleinHouse,
				},
				transition: calculation.klein.transition,
			},
			fiveSubstrates: {
				movement: calculation.projections.mu,
				evolution: calculation.projections.e,
				being: calculation.projections.b,
				design: calculation.projections.d,
				space: calculation.projections.s,
			},
		},
		resolvedCapability: resolution.selected.descriptor.componentId,
		action: {
			status: action.status,
			toolId: action.tool.id,
			toolName: action.tool.name,
			addressKey: action.tool.addressKey,
			dimension: action.tool.dimension,
			level: action.tool.level,
			levelName: action.tool.levelName,
		},
		verification,
	}, null, 2));
});

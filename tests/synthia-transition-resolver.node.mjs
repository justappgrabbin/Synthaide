import test from "node:test";
import assert from "node:assert/strict";

import componentRegistry from "../src/synthia/identity/componentRegistry.mjs";
import TransitionIndex from "../src/synthia/resolver/TransitionIndex.mjs";
import TransitionResolver from "../src/synthia/resolver/TransitionResolver.mjs";
import { deriveTransitionDescriptor } from "../src/synthia/resolver/TransitionDescriptor.mjs";
import synthia from "../src/synthia/synthiaRuntime.mjs";

function identity(id, transition) {
	return componentRegistry.identify({
		id,
		name: id,
		kind: "component",
		what: { capabilities: [`${id}.run`] },
		why: "Transition resolver test fixture.",
		how: { mechanism: "fixture" },
		relationships: [],
		behaviors: [],
		dependencies: [],
		when: { activation: "fixture" },
		provenance: { source: "test" },
		transition,
	});
}

test("canonical intake derives a transition descriptor for every addressed component", () => {
	const item = componentRegistry.identify({
		id: "transition-intake-unresolved-fixture",
		name: "Unresolved fixture",
		kind: "component",
		what: { capabilities: ["fixture.run"] },
		why: "Proves transition questions are always asked.",
		how: { mechanism: "fixture" },
		relationships: [],
		behaviors: [],
		dependencies: [],
		when: { activation: "fixture" },
		provenance: { source: "test" },
	});
	assert.ok(item.address);
	assert.ok(item.transition);
	assert.equal(item.transition.status, "unresolved");
	assert.equal(item.transition.accepts.status, "unresolved");
	assert.equal(item.transition.produces.status, "unresolved");
});

test("inverse transition index finds capability by the state it produces", () => {
	const record = identity("transition-persistence-fixture", {
		accepts: ["volatile"],
		produces: ["persistent"],
		solves: ["state-cannot-persist"],
	});
	const index = new TransitionIndex();
	index.register(record.transition);
	const found = index.findByOutput(["persistent"]);
	assert.equal(found.length, 1);
	assert.equal(found[0].componentId, record.id);
});

test("resolver recursively satisfies prerequisite transitions", () => {
	const index = new TransitionIndex();
	const address = { dimension: "Design", gate: 1, line: 1, color: 1, tone: 1, base: 1 };

	index.register(deriveTransitionDescriptor({
		id: "fixture-classifier",
		address,
		what: { value: {} },
		when: { value: {} },
		dependencies: { value: [] },
		provenance: { value: { source: "test" } },
	}, {
		accepts: ["unclassified"],
		produces: ["classified"],
	}));

	index.register(deriveTransitionDescriptor({
		id: "fixture-placer",
		address: { ...address, gate: 2 },
		what: { value: {} },
		when: { value: {} },
		dependencies: { value: [] },
		provenance: { value: { source: "test" } },
	}, {
		accepts: ["classified"],
		produces: ["addressed"],
	}));

	index.register(deriveTransitionDescriptor({
		id: "fixture-materializer",
		address: { ...address, gate: 3 },
		what: { value: {} },
		when: { value: {} },
		dependencies: { value: [] },
		provenance: { value: { source: "test" } },
	}, {
		accepts: ["addressed"],
		produces: ["executable"],
	}));

	const resolver = new TransitionResolver({ index });
	const plan = resolver.plan(["unclassified"], ["executable"]);

	assert.equal(plan.status, "planned");
	assert.deepEqual(
		plan.steps.map((step) => step.componentId),
		["fixture-classifier", "fixture-placer", "fixture-materializer"],
	);
	assert.ok(plan.projectedState.includes("executable"));
});

test("resolver executes the planned chain and verifies the desired state", async () => {
	const index = new TransitionIndex();
	const descriptors = [
		["fixture-a", ["raw"], ["structured"]],
		["fixture-b", ["structured"], ["verified"]],
	].map(([id, accepts, produces], i) =>
		deriveTransitionDescriptor({
			id,
			address: { dimension: "Being", gate: i + 10, line: 1, color: 1, tone: 1, base: 1 },
			what: { value: {} },
			when: { value: {} },
			dependencies: { value: [] },
			provenance: { value: { source: "test" } },
		}, { accepts, produces }),
	);

	for (const descriptor of descriptors) index.register(descriptor);

	const resolver = new TransitionResolver({
		index,
		activate: async (descriptor, payload) => ({
			state: [...payload.current, ...descriptor.produces.value],
		}),
	});

	const solved = await resolver.solve(["raw"], ["verified"]);
	assert.equal(solved.status, "solved");
	assert.equal(solved.verification.status, "supported");
	assert.equal(solved.executions.length, 2);
});

test("live Synthia mounts Transition Resolver and indexes known core transformations", () => {
	const snapshot = synthia.snapshot();
	const transition = snapshot.transitionResolver;
	assert.ok(transition);
	assert.ok(transition.index.count > 0);

	const executableCandidates =
		synthia.selfIntegration.transitionResolver.index.findByOutput(["executable"]);
	assert.ok(
		executableCandidates.some((descriptor) =>
			descriptor.componentId.includes("tool-synthesis"),
		),
	);
});

test("unreachable desired states stay unresolved instead of inventing a capability", () => {
	const resolver = new TransitionResolver({ index: new TransitionIndex() });
	const plan = resolver.plan(["known"], ["not-known-anywhere"]);
	assert.equal(plan.status, "unresolved");
	assert.match(plan.reason, /No reachable transition/);
});


test("successful transition outcomes reinforce capability-to-state resonance", async () => {
	const index = new TransitionIndex();
	const events = [];
	const resonance = {
		observe(event) {
			events.push(event);
			return event;
		},
		score() {
			return { score: 0 };
		},
	};

	const descriptor = deriveTransitionDescriptor({
		id: "fixture-resonant-transition",
		address: { dimension: "Evolution", gate: 21, line: 1, color: 1, tone: 1, base: 1 },
		what: { value: {} },
		when: { value: {} },
		dependencies: { value: [] },
		provenance: { value: { source: "test" } },
	}, {
		accepts: ["problem-present"],
		produces: ["problem-resolved"],
	});
	index.register(descriptor);

	const resolver = new TransitionResolver({
		index,
		resonance,
		activate: async (_descriptor, payload) => ({
			state: [...payload.current, "problem-resolved"],
		}),
	});

	const result = await resolver.solve(
		["problem-present"],
		["problem-resolved"],
	);

	assert.equal(result.status, "solved");
	assert.equal(events.length, 1);
	assert.equal(events[0].a, "fixture-resonant-transition");
	assert.equal(events[0].b, "state:problem-resolved");
	assert.equal(events[0].type, "transition-outcome");
	assert.equal(events[0].outcome, 1);
});

import test from "node:test";
import assert from "node:assert/strict";

import { AutomataMesh } from "../src/synthia/ato-core/automaton.mjs";
import {
	DataEfficientGrammar,
	degGrammarAutomaton,
} from "../src/synthia/deg/grammar.mjs";
import {
	GrammarGeometry,
	geoDegAutomaton,
} from "../src/synthia/geo-deg/geometry.mjs";
import {
	GrammarSystemsRuntime,
} from "../src/synthia/grammarSystemsRuntime.mjs";

const EXAMPLES = [
	"alpha beta gamma",
	"alpha beta delta",
	"beta gamma epsilon",
];

test("DEG learner extracts reusable production rules from a tiny generic dataset", () => {
	const grammar = new DataEfficientGrammar();
	const snapshot = grammar.learn(EXAMPLES, { minSupport: 2 });

	assert.equal(snapshot.exampleCount, 3);
	assert.ok(snapshot.ruleCount >= 2);
	assert.ok(snapshot.rules.some((rule) => rule.support >= 2));
	assert.ok(snapshot.rules.every((rule) => rule.lhs.anchor));
	assert.ok(snapshot.rules.every((rule) => rule.rhs.nodes.length >= 2));
});

test("DEG production rules can generate a new graph without Geo-DEG", () => {
	const grammar = new DataEfficientGrammar();
	grammar.learn(EXAMPLES, { minSupport: 1 });
	const result = grammar.generate({ maxApplications: 3 });

	assert.ok(result.graph.nodes.length >= 2);
	assert.ok(result.graph.edges.length >= 1);
	assert.ok(result.applications.length >= 1);
});

test("DEG Automaton can live by itself on its own mesh", async () => {
	const mesh = new AutomataMesh();
	const deg = mesh.add(degGrammarAutomaton());
	const grammar = await deg.call({
		op: "learn",
		examples: EXAMPLES,
		options: { minSupport: 2 },
	});

	assert.equal(mesh.automatons.size, 1);
	assert.equal(deg.id, "deg-grammar-learner");
	assert.ok(grammar.ruleCount >= 2);
});

test("Geo-DEG geometry can live by itself and consume a grammar data contract", async () => {
	const grammar = new DataEfficientGrammar().learn(EXAMPLES, { minSupport: 1 });
	const mesh = new AutomataMesh();
	const geo = mesh.add(geoDegAutomaton());
	const geometry = await geo.call({ op: "build", grammar });

	assert.equal(mesh.automatons.size, 1);
	assert.equal(geo.id, "geo-deg-grammar-geometry");
	assert.equal(geometry.nodeCount, grammar.ruleCount);
	assert.ok(geometry.edgeCount >= 1);
});

test("Geo-DEG exposes similarity neighborhoods, routes, composition, and diffusion", () => {
	const grammar = new DataEfficientGrammar().learn(EXAMPLES, { minSupport: 1 });
	const geometry = new GrammarGeometry();
	const snapshot = geometry.build(grammar);
	const firstEdge = snapshot.edges[0];

	assert.ok(firstEdge);
	const neighbors = geometry.neighbors(firstEdge.from);
	assert.ok(neighbors.some((item) => item.node.id === firstEdge.to));

	const route = geometry.route(firstEdge.from, firstEdge.to);
	assert.equal(route.reachable, true);
	assert.equal(route.nodes[0], firstEdge.from);
	assert.equal(route.nodes.at(-1), firstEdge.to);

	const composition = geometry.compose(route);
	assert.equal(composition.path.length, route.nodes.length);
	assert.ok(composition.labels.length >= 2);

	const diffusion = geometry.diffuse({ [firstEdge.from]: 1 }, { steps: 2 });
	assert.equal(diffusion.values[firstEdge.from] >= 0, true);
	assert.ok(diffusion.values[firstEdge.to] > 0);
});

test("shared roof connects DEG output to Geo-DEG without merging their state", async () => {
	const runtime = new GrammarSystemsRuntime();
	const result = await runtime.learnAndIndex(EXAMPLES, { minSupport: 1 });

	assert.deepEqual(result.visited, [
		"deg-grammar-learner",
		"geo-deg-grammar-geometry",
	]);
	assert.ok(result.grammar.ruleCount > 0);
	assert.equal(result.geometry.nodeCount, result.grammar.ruleCount);
	assert.notEqual(runtime.deg.ownedState, runtime.geoDeg.ownedState);
	assert.equal(runtime.connection.status, "connected");
});

test("DEG and Geo-DEG advertise separate independent ATO manifests", () => {
	const deg = degGrammarAutomaton().manifest();
	const geo = geoDegAutomaton().manifest();

	assert.equal(deg.metadata.independent, true);
	assert.equal(geo.metadata.independent, true);
	assert.equal(deg.functionalLevel, "design");
	assert.equal(geo.functionalLevel, "space");
	assert.notEqual(deg.addressKey, geo.addressKey);
});

test("Settings exposes the grammar systems without turning them into Morph", async () => {
	const fs = await import("node:fs");
	const source = fs.readFileSync(
		new URL("../src/pages/welcome/welcome.js", import.meta.url),
		"utf8",
	);
	assert.match(source, /import grammarSystems from "synthia\/grammarSystemsRuntime\.mjs"/);
	assert.match(source, /grammar: \(\) => GrammarSystems\(\)/);
	assert.match(source, /function GrammarSystems\(\)/);
	assert.match(source, /Learning \/ Grammar Geometry/);
});

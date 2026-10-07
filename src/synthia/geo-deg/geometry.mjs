import { Automaton } from "../ato-core/automaton.mjs";

function asSet(values) {
	return new Set((values || []).map((value) => String(value).toLowerCase()));
}

function jaccard(leftValues, rightValues) {
	const left = asSet(leftValues);
	const right = asSet(rightValues);
	if (!left.size && !right.size) return 1;
	let intersection = 0;
	for (const value of left) {
		if (right.has(value)) intersection += 1;
	}
	const union = new Set([...left, ...right]).size || 1;
	return intersection / union;
}

function ruleLabels(rule) {
	return [
		rule?.lhs?.anchor,
		...(rule?.rhs?.nodes || []),
	].filter(Boolean);
}

function relationBetween(left, right) {
	const similarity = jaccard(ruleLabels(left), ruleLabels(right));
	const leftOutputs = asSet(left?.rhs?.nodes || []);
	const rightOutputs = asSet(right?.rhs?.nodes || []);
	const leftToRight = leftOutputs.has(String(right?.lhs?.anchor || "").toLowerCase());
	const rightToLeft = rightOutputs.has(String(left?.lhs?.anchor || "").toLowerCase());

	if (!leftToRight && !rightToLeft && similarity <= 0) return null;

	const compositional = leftToRight || rightToLeft;
	const affinity = Math.min(
		1,
		similarity * 0.7 + (compositional ? 0.3 : 0),
	);
	return Object.freeze({
		similarity,
		compositional,
		leftToRight,
		rightToLeft,
		affinity,
		distance: 1 / Math.max(0.05, affinity),
	});
}

function freezeNode(rule) {
	return Object.freeze({
		id: rule.id,
		ruleId: rule.id,
		level: Math.max(1, (rule?.motif?.size || rule?.rhs?.nodes?.length || 1) - 1),
		support: Number(rule.support || 0),
		score: Number(rule.score || 0),
		labels: Object.freeze(ruleLabels(rule)),
		anchor: rule?.lhs?.anchor || null,
	});
}

function freezeEdge(edge) {
	return Object.freeze({ ...edge });
}

/**
 * Explicit, dependency-free grammar-induced geometry.
 *
 * It consumes a production grammar through data, not imports, so the geometry
 * automaton can live independently from the DEG learner.
 */
export class GrammarGeometry {
	constructor() {
		this.nodes = new Map();
		this.edges = new Map();
		this.adjacency = new Map();
		this.version = 0;
	}

	reset() {
		this.nodes.clear();
		this.edges.clear();
		this.adjacency.clear();
		this.version += 1;
		return this.snapshot();
	}

	build(grammar, { minAffinity = 0.05 } = {}) {
		if (!grammar || !Array.isArray(grammar.rules)) {
			throw new TypeError("Geo-DEG geometry requires a grammar with a rules array.");
		}
		if (!(minAffinity >= 0 && minAffinity <= 1)) {
			throw new RangeError("minAffinity must be between 0 and 1.");
		}

		this.nodes.clear();
		this.edges.clear();
		this.adjacency.clear();

		for (const rule of grammar.rules) {
			if (!rule?.id) throw new TypeError("Every grammar rule requires an id.");
			const node = freezeNode(rule);
			this.nodes.set(node.id, node);
			this.adjacency.set(node.id, []);
		}

		const rules = grammar.rules;
		for (let leftIndex = 0; leftIndex < rules.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < rules.length; rightIndex += 1) {
				const left = rules[leftIndex];
				const right = rules[rightIndex];
				const relation = relationBetween(left, right);
				if (!relation || relation.affinity < minAffinity) continue;
				const edge = freezeEdge({
					id: `${left.id}<->${right.id}`,
					from: left.id,
					to: right.id,
					kind: relation.compositional ? "composition+similarity" : "similarity",
					similarity: relation.similarity,
					affinity: relation.affinity,
					distance: relation.distance,
					leftToRight: relation.leftToRight,
					rightToLeft: relation.rightToLeft,
				});
				this.edges.set(edge.id, edge);
				this.adjacency.get(edge.from).push(edge);
				this.adjacency.get(edge.to).push(edge);
			}
		}

		for (const [id, edges] of this.adjacency) {
			edges.sort((left, right) => (
				right.affinity - left.affinity || left.id.localeCompare(right.id)
			));
			this.adjacency.set(id, edges);
		}
		this.version += 1;
		return this.snapshot();
	}

	neighbors(id, { limit = 8 } = {}) {
		if (!this.nodes.has(id)) throw new RangeError(`Unknown geometry node: ${id}`);
		return Object.freeze(
			(this.adjacency.get(id) || [])
				.slice(0, limit)
				.map((edge) => {
					const neighborId = edge.from === id ? edge.to : edge.from;
					return Object.freeze({
						node: this.nodes.get(neighborId),
						edge,
					});
				}),
		);
	}

	route(from, to) {
		if (!this.nodes.has(from) || !this.nodes.has(to)) {
			throw new RangeError("Both route endpoints must exist in the grammar geometry.");
		}
		if (from === to) {
			return Object.freeze({
				reachable: true,
				distance: 0,
				nodes: Object.freeze([from]),
				edges: Object.freeze([]),
			});
		}

		const distances = new Map([...this.nodes.keys()].map((id) => [id, Infinity]));
		const previous = new Map();
		const unvisited = new Set(this.nodes.keys());
		distances.set(from, 0);

		while (unvisited.size) {
			let current = null;
			let currentDistance = Infinity;
			for (const id of unvisited) {
				const candidate = distances.get(id);
				if (candidate < currentDistance) {
					current = id;
					currentDistance = candidate;
				}
			}
			if (current === null || currentDistance === Infinity) break;
			unvisited.delete(current);
			if (current === to) break;

			for (const edge of this.adjacency.get(current) || []) {
				const neighbor = edge.from === current ? edge.to : edge.from;
				if (!unvisited.has(neighbor)) continue;
				const nextDistance = currentDistance + edge.distance;
				if (nextDistance < distances.get(neighbor)) {
					distances.set(neighbor, nextDistance);
					previous.set(neighbor, { node: current, edge });
				}
			}
		}

		if (!previous.has(to)) {
			return Object.freeze({
				reachable: false,
				distance: Infinity,
				nodes: Object.freeze([]),
				edges: Object.freeze([]),
			});
		}

		const nodes = [to];
		const edges = [];
		let cursor = to;
		while (cursor !== from) {
			const step = previous.get(cursor);
			edges.unshift(step.edge);
			cursor = step.node;
			nodes.unshift(cursor);
		}
		return Object.freeze({
			reachable: true,
			distance: distances.get(to),
			nodes: Object.freeze(nodes),
			edges: Object.freeze(edges),
		});
	}

	diffuse(signal, {
		steps = 3,
		retain = 0.35,
	} = {}) {
		if (!Number.isInteger(steps) || steps < 0) {
			throw new RangeError("steps must be a non-negative integer.");
		}
		if (!(retain >= 0 && retain <= 1)) {
			throw new RangeError("retain must be between 0 and 1.");
		}
		const initial = Object.fromEntries(
			[...this.nodes.keys()].map((id) => [id, Number(signal?.[id] || 0)]),
		);
		let values = { ...initial };

		for (let step = 0; step < steps; step += 1) {
			const next = {};
			for (const id of this.nodes.keys()) {
				const edges = this.adjacency.get(id) || [];
				const totalAffinity = edges.reduce((sum, edge) => sum + edge.affinity, 0);
				let neighborSignal = 0;
				if (totalAffinity > 0) {
					for (const edge of edges) {
						const neighbor = edge.from === id ? edge.to : edge.from;
						neighborSignal += values[neighbor] * edge.affinity / totalAffinity;
					}
				}
				next[id] = retain * initial[id] + (1 - retain) * (
					totalAffinity > 0 ? neighborSignal : values[id]
				);
			}
			values = next;
		}

		return Object.freeze({
			steps,
			retain,
			values: Object.freeze({ ...values }),
		});
	}

	compose(pathOrRoute) {
		const nodeIds = Array.isArray(pathOrRoute)
			? pathOrRoute
			: pathOrRoute?.nodes;
		if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
			throw new TypeError("compose requires a non-empty geometry path.");
		}
		const nodes = nodeIds.map((id) => {
			const node = this.nodes.get(id);
			if (!node) throw new RangeError(`Unknown geometry node: ${id}`);
			return node;
		});
		return Object.freeze({
			path: Object.freeze([...nodeIds]),
			anchors: Object.freeze(nodes.map((node) => node.anchor)),
			labels: Object.freeze([...new Set(nodes.flatMap((node) => node.labels))]),
			levels: Object.freeze(nodes.map((node) => node.level)),
		});
	}

	snapshot() {
		return Object.freeze({
			kind: "synthia.geo-deg.geometry.v1",
			version: this.version,
			nodeCount: this.nodes.size,
			edgeCount: this.edges.size,
			nodes: Object.freeze([...this.nodes.values()]),
			edges: Object.freeze([...this.edges.values()]),
		});
	}
}

export function geoDegAutomaton({
	geometry = new GrammarGeometry(),
} = {}) {
	return new Automaton({
		id: "geo-deg-grammar-geometry",
		address: {
			mode: "macro",
			gate: 43,
			line: 1,
			color: 1,
			tone: 1,
			base: 1,
		},
		structure: "hexagram",
		activeLevels: [1, 2, 3, 4, 5],
		functionalLevel: "space",
		ports: [
			{
				id: "grammar",
				direction: "input",
				type: "production-grammar",
				schemaVersion: "1",
				requires: ["production-rules"],
			},
			{
				id: "geometry",
				direction: "output",
				type: "grammar-geometry",
				schemaVersion: "1",
				guarantees: ["similarity", "reachability", "routing"],
			},
		],
		state: geometry,
		metadata: {
			family: "geo-deg",
			independent: true,
			adaptation: "browser-native-domain-general",
			sourceConcept: "Hierarchical Grammar-Induced Geometry",
			capabilities: Object.freeze([
				"geometry.build",
				"geometry.neighbors",
				"geometry.route",
				"geometry.diffuse",
				"geometry.compose",
				"geometry.snapshot",
			]),
		},
		implementation: (input, { state }) => {
			if (input?.kind === "synthia.deg.grammar.v1" && Array.isArray(input.rules)) {
				return state.build(input);
			}
			const operation = input?.op || "snapshot";
			if (operation === "build") {
				return state.build(input.grammar, input.options);
			}
			if (operation === "neighbors") {
				return state.neighbors(input.id, input.options);
			}
			if (operation === "route") {
				return state.route(input.from, input.to);
			}
			if (operation === "diffuse") {
				return state.diffuse(input.signal, input.options);
			}
			if (operation === "compose") {
				return state.compose(input.path || input.route);
			}
			if (operation === "reset") {
				return state.reset();
			}
			if (operation === "snapshot") {
				return state.snapshot();
			}
			throw new RangeError(`Unknown Geo-DEG operation: ${operation}`);
		},
	});
}

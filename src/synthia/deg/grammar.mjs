import { Automaton } from "../ato-core/automaton.mjs";

function stableLabel(value) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function tokenizeText(value) {
	return stableLabel(value).match(/[a-z0-9_'-]+/g) || [];
}

function normalizeNode(node, index) {
	if (typeof node === "string" || typeof node === "number") {
		return Object.freeze({
			id: `n${index}`,
			label: stableLabel(node),
			type: "token",
		});
	}
	if (!node || typeof node !== "object") {
		throw new TypeError(`Invalid graph node at index ${index}.`);
	}
	return Object.freeze({
		id: String(node.id ?? `n${index}`),
		label: stableLabel(node.label ?? node.name ?? node.type ?? node.id ?? `n${index}`),
		type: stableLabel(node.type || "node"),
	});
}

function normalizeEdge(edge, index, nodeIds) {
	let from;
	let to;
	let type = "relation";
	if (Array.isArray(edge)) {
		[from, to, type = "relation"] = edge;
	} else if (edge && typeof edge === "object") {
		from = edge.from ?? edge.source;
		to = edge.to ?? edge.target;
		type = edge.type ?? edge.label ?? "relation";
	} else {
		throw new TypeError(`Invalid graph edge at index ${index}.`);
	}

	const resolve = (value) => {
		if (Number.isInteger(value) && value >= 0 && value < nodeIds.length) {
			return nodeIds[value];
		}
		return String(value);
	};
	const normalizedFrom = resolve(from);
	const normalizedTo = resolve(to);
	if (!nodeIds.includes(normalizedFrom) || !nodeIds.includes(normalizedTo)) {
		throw new RangeError(`Edge ${index} references an unknown node.`);
	}
	return Object.freeze({
		id: `e${index}`,
		from: normalizedFrom,
		to: normalizedTo,
		type: stableLabel(type || "relation"),
	});
}

/**
 * Converts strings or generic graph records to the small graph contract used
 * by the browser-native DEG adaptation.
 */
export function normalizeGraph(example, index = 0) {
	if (typeof example === "string") {
		const tokens = tokenizeText(example);
		const nodes = tokens.map((label, nodeIndex) => Object.freeze({
			id: `g${index}-n${nodeIndex}`,
			label,
			type: "token",
		}));
		const edges = nodes.slice(1).map((node, edgeIndex) => Object.freeze({
			id: `g${index}-e${edgeIndex}`,
			from: nodes[edgeIndex].id,
			to: node.id,
			type: "next",
		}));
		return Object.freeze({
			id: `example-${index}`,
			nodes: Object.freeze(nodes),
			edges: Object.freeze(edges),
			source: example,
		});
	}
	if (!example || typeof example !== "object" || !Array.isArray(example.nodes)) {
		throw new TypeError("DEG examples must be strings or {nodes, edges} graphs.");
	}
	const nodes = example.nodes.map(normalizeNode);
	const nodeIds = nodes.map((node) => node.id);
	const edges = (example.edges || []).map((edge, edgeIndex) => (
		normalizeEdge(edge, edgeIndex, nodeIds)
	));
	return Object.freeze({
		id: String(example.id ?? `example-${index}`),
		nodes: Object.freeze(nodes),
		edges: Object.freeze(edges),
		source: example.source ?? null,
	});
}

function adjacency(graph) {
	const map = new Map(graph.nodes.map((node) => [node.id, new Set()]));
	for (const edge of graph.edges) {
		map.get(edge.from)?.add(edge.to);
		map.get(edge.to)?.add(edge.from);
	}
	return map;
}

function nodeById(graph) {
	return new Map(graph.nodes.map((node) => [node.id, node]));
}

function canonicalLabels(labels) {
	return [...labels].map(stableLabel).sort().join("|");
}

function edgeMotifs(graph) {
	const nodes = nodeById(graph);
	return graph.edges.map((edge) => {
		const a = nodes.get(edge.from);
		const b = nodes.get(edge.to);
		const labels = [a.label, b.label];
		return Object.freeze({
			kind: "edge",
			labels: Object.freeze(labels),
			edgeTypes: Object.freeze([edge.type]),
			signature: `edge:${canonicalLabels(labels)}:${edge.type}`,
			anchor: a.label,
			expansion: Object.freeze([b.label]),
			size: 2,
		});
	});
}

function pathMotifs(graph) {
	const neighbors = adjacency(graph);
	const nodes = nodeById(graph);
	const motifs = [];
	const seen = new Set();

	for (const center of graph.nodes) {
		const around = [...(neighbors.get(center.id) || [])].sort();
		for (let left = 0; left < around.length; left += 1) {
			for (let right = left + 1; right < around.length; right += 1) {
				const a = nodes.get(around[left]);
				const b = nodes.get(around[right]);
				const labels = [a.label, center.label, b.label];
				const signature = `path:${center.label}:${canonicalLabels([a.label, b.label])}`;
				if (seen.has(signature)) continue;
				seen.add(signature);
				motifs.push(Object.freeze({
					kind: "path",
					labels: Object.freeze(labels),
					edgeTypes: Object.freeze(["relation", "relation"]),
					signature,
					anchor: center.label,
					expansion: Object.freeze([a.label, b.label]),
					size: 3,
				}));
			}
		}
	}
	return motifs;
}

function extractMotifs(graph) {
	return Object.freeze([...edgeMotifs(graph), ...pathMotifs(graph)]);
}

function scoreMotif(record, exampleCount) {
	const supportRatio = record.examples.size / Math.max(1, exampleCount);
	const recurrence = Math.log2(record.occurrences + 1);
	const compactness = 1 / Math.max(1, record.motif.size - 1);
	return supportRatio * 0.65 + Math.min(1, recurrence / 3) * 0.25 + compactness * 0.1;
}

function freezeRule(rule) {
	return Object.freeze({
		...rule,
		lhs: Object.freeze({ ...rule.lhs }),
		rhs: Object.freeze({
			nodes: Object.freeze([...rule.rhs.nodes]),
			edges: Object.freeze(rule.rhs.edges.map((edge) => Object.freeze({ ...edge }))),
		}),
		motif: Object.freeze({
			kind: rule.motif.kind,
			labels: Object.freeze([...rule.motif.labels]),
			edgeTypes: Object.freeze([...rule.motif.edgeTypes]),
			signature: rule.motif.signature,
			size: rule.motif.size,
		}),
		examples: Object.freeze([...rule.examples]),
	});
}

/**
 * Dependency-free, domain-general adaptation of DEG's reusable graph-grammar
 * idea. It learns recurrent connected motifs and turns them into executable
 * production rules. It intentionally does not import the molecular RDKit /
 * PyTorch training stack from the research repository.
 */
export class DataEfficientGrammar {
	constructor() {
		this.examples = [];
		this.rules = [];
		this.motifIndex = new Map();
		this.version = 0;
	}

	reset() {
		this.examples = [];
		this.rules = [];
		this.motifIndex.clear();
		this.version += 1;
		return this.snapshot();
	}

	learn(examples, { minSupport = 1, maxRules = 128 } = {}) {
		if (!Array.isArray(examples) || examples.length === 0) {
			throw new TypeError("DEG learning requires at least one example.");
		}
		if (!Number.isInteger(minSupport) || minSupport < 1) {
			throw new RangeError("minSupport must be a positive integer.");
		}
		const graphs = examples.map(normalizeGraph);
		const index = new Map();

		for (const graph of graphs) {
			for (const motif of extractMotifs(graph)) {
				const existing = index.get(motif.signature) || {
					motif,
					occurrences: 0,
					examples: new Set(),
				};
				existing.occurrences += 1;
				existing.examples.add(graph.id);
				index.set(motif.signature, existing);
			}
		}

		const candidates = [...index.values()]
			.filter((record) => record.examples.size >= minSupport)
			.map((record) => ({
				...record,
				score: scoreMotif(record, graphs.length),
			}))
			.sort((left, right) => (
				right.score - left.score
				|| right.examples.size - left.examples.size
				|| left.motif.signature.localeCompare(right.motif.signature)
			))
			.slice(0, maxRules);

		this.examples = graphs;
		this.motifIndex = index;
		this.rules = candidates.map((record, ruleIndex) => {
			const rhsNodes = [record.motif.anchor, ...record.motif.expansion];
			const rhsEdges = rhsNodes.slice(1).map((_, edgeIndex) => ({
				from: edgeIndex === 0 ? 0 : 0,
				to: edgeIndex + 1,
				type: record.motif.edgeTypes[edgeIndex] || "relation",
			}));
			return freezeRule({
				id: `deg-rule-${ruleIndex + 1}`,
				lhs: { anchor: record.motif.anchor },
				rhs: { nodes: rhsNodes, edges: rhsEdges },
				motif: record.motif,
				support: record.examples.size,
				occurrences: record.occurrences,
				score: record.score,
				examples: [...record.examples].sort(),
			});
		});
		this.version += 1;
		return this.snapshot();
	}

	generate({
		seed = null,
		maxApplications = 8,
		ruleIds = null,
	} = {}) {
		if (!this.rules.length) {
			throw new Error("DEG has no learned production rules yet.");
		}
		if (!Number.isInteger(maxApplications) || maxApplications < 0) {
			throw new RangeError("maxApplications must be a non-negative integer.");
		}
		const allowed = ruleIds
			? new Set(ruleIds.map(String))
			: null;
		const rules = this.rules.filter((rule) => !allowed || allowed.has(rule.id));
		if (!rules.length) throw new Error("No requested production rules are available.");

		const graph = seed === null
			? {
				id: "generated",
				nodes: [{ id: "n0", label: rules[0].lhs.anchor, type: "generated" }],
				edges: [],
			}
			: structuredClone(normalizeGraph(seed));
		const applications = [];

		for (let step = 0; step < maxApplications; step += 1) {
			let applied = false;
			for (const rule of rules) {
				const anchor = graph.nodes.find((node) => node.label === rule.lhs.anchor);
				if (!anchor) continue;
				const created = [];
				for (const label of rule.rhs.nodes.slice(1)) {
					const id = `n${graph.nodes.length}`;
					graph.nodes.push({ id, label, type: "generated" });
					graph.edges.push({
						id: `e${graph.edges.length}`,
						from: anchor.id,
						to: id,
						type: "production",
						ruleId: rule.id,
					});
					created.push(id);
				}
				applications.push(Object.freeze({
					step: step + 1,
					ruleId: rule.id,
					anchor: anchor.id,
					created: Object.freeze(created),
				}));
				applied = true;
				break;
			}
			if (!applied) break;
		}

		return Object.freeze({
			graph: Object.freeze({
				id: graph.id || "generated",
				nodes: Object.freeze(graph.nodes.map((node) => Object.freeze({ ...node }))),
				edges: Object.freeze(graph.edges.map((edge) => Object.freeze({ ...edge }))),
			}),
			applications: Object.freeze(applications),
			rulesAvailable: rules.length,
		});
	}

	snapshot() {
		return Object.freeze({
			kind: "synthia.deg.grammar.v1",
			version: this.version,
			exampleCount: this.examples.length,
			ruleCount: this.rules.length,
			rules: Object.freeze([...this.rules]),
		});
	}
}

export function degGrammarAutomaton({
	grammar = new DataEfficientGrammar(),
} = {}) {
	return new Automaton({
		id: "deg-grammar-learner",
		address: {
			mode: "macro",
			gate: 48,
			line: 1,
			color: 1,
			tone: 1,
			base: 1,
		},
		structure: "hexagram",
		activeLevels: [1, 2, 3, 4, 5],
		functionalLevel: "design",
		ports: [
			{
				id: "examples",
				direction: "input",
				type: "generic-graph-examples",
				schemaVersion: "1",
			},
			{
				id: "grammar",
				direction: "output",
				type: "production-grammar",
				schemaVersion: "1",
				guarantees: ["domain-general", "production-rules"],
			},
		],
		state: grammar,
		metadata: {
			family: "deg",
			independent: true,
			adaptation: "browser-native-domain-general",
			sourceConcept: "Data-Efficient Graph Grammar Learning",
			capabilities: Object.freeze([
				"grammar.learn",
				"grammar.generate",
				"grammar.snapshot",
			]),
		},
		implementation: (input, { state }) => {
			const operation = input?.op || "snapshot";
			if (operation === "learn") {
				return state.learn(input.examples, input.options);
			}
			if (operation === "generate") {
				return state.generate(input.options);
			}
			if (operation === "reset") {
				return state.reset();
			}
			if (operation === "snapshot") {
				return state.snapshot();
			}
			throw new RangeError(`Unknown DEG operation: ${operation}`);
		},
	});
}

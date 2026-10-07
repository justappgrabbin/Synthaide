import { Automaton } from "../ato-core/automaton.mjs";
import { tokenize } from "./semanticMesh.mjs";

const PERSPECTIVE_DEFINITIONS = Object.freeze([
	Object.freeze({
		id: "movement",
		label: "Movement",
		functionalLevel: "movement",
		address: { mode: "macro", gate: 1, line: 1, color: 1, tone: 1, base: 1 },
		keywords: ["name", "show", "see", "visible", "output", "make", "code", "word", "surface"],
		prompt: "What is concretely visible, nameable, or expressible here?",
	}),
	Object.freeze({
		id: "evolution",
		label: "Evolution",
		functionalLevel: "mind",
		address: { mode: "macro", gate: 24, line: 1, color: 1, tone: 1, base: 1 },
		keywords: ["remember", "memory", "history", "before", "pattern", "learn", "change", "again"],
		prompt: "What prior pattern, memory, or trajectory changes this reading?",
	}),
	Object.freeze({
		id: "being",
		label: "Being",
		functionalLevel: "being",
		address: { mode: "macro", gate: 10, line: 1, color: 1, tone: 1, base: 1 },
		keywords: ["state", "current", "real", "now", "body", "object", "file", "exists", "actual"],
		prompt: "What is the current bounded state and what actually exists?",
	}),
	Object.freeze({
		id: "design",
		label: "Design",
		functionalLevel: "design",
		address: { mode: "macro", gate: 62, line: 1, color: 1, tone: 1, base: 1 },
		keywords: ["why", "cause", "structure", "dependency", "function", "architecture", "test", "debug", "plan"],
		prompt: "What structure, dependency, or cause must be respected?",
	}),
]);

const ASPECT_DEFINITIONS = Object.freeze([
	Object.freeze({
		id: "human",
		label: "Human",
		keywords: ["i", "me", "we", "you", "feel", "want", "need", "think", "conversation"],
	}),
	Object.freeze({
		id: "relational",
		label: "Relational",
		keywords: ["connect", "relation", "between", "similar", "different", "neighbor", "route", "mesh"],
	}),
	Object.freeze({
		id: "critical",
		label: "Critical",
		keywords: ["check", "prove", "validate", "bug", "wrong", "risk", "test", "verify"],
	}),
	Object.freeze({
		id: "generative",
		label: "Generative",
		keywords: ["morph", "branch", "combine", "possible", "alternative", "generate", "imagine", "evolve"],
	}),
]);

function normalizedScores(definitions, text, semantic, history) {
	const tokens = new Set(tokenize(text));
	const lower = String(text).toLowerCase();
	const scores = definitions.map((definition, index) => {
		let score = 1;
		for (const keyword of definition.keywords) {
			if (tokens.has(keyword) || lower.includes(keyword)) score += 1.4;
		}
		if (semantic.dimension?.toLowerCase() === definition.id) score += 2.4;
		if (semantic.intent === "code" && ["movement", "design", "critical"].includes(definition.id)) score += 2;
		if (semantic.intent === "memory" && definition.id === "evolution") score += 3;
		if (history.length > 2 && definition.id === "evolution") score += 0.8;
		return { ...definition, score, order: index };
	});
	const total = scores.reduce((sum, item) => sum + item.score, 0) || 1;
	return Object.freeze(scores.map((item) => Object.freeze({
		id: item.id,
		label: item.label,
		weight: item.score / total,
	})));
}

function observationFor(definition, payload) {
	const { semantic, text, history } = payload;
	const focus = semantic.focus;
	const previous = history.length > 1 ? history.at(-2)?.text : null;
	if (definition.id === "movement") {
		return `Name the requested ${semantic.intent} around “${focus}” and make the output concrete.`;
	}
	if (definition.id === "evolution") {
		return previous
			? `Read “${focus}” against the prior turn “${String(previous).slice(0, 90)}”.`
			: `Treat “${focus}” as the first observed point in this conversation trajectory.`;
	}
	if (definition.id === "being") {
		return `Anchor the response in the current request as stated: ${String(text).slice(0, 130)}.`;
	}
	return semantic.intent === "code"
		? "Preserve executable structure, explicit interfaces, edge cases, and a testable result."
		: `Resolve dependencies and causes before choosing wording for “${focus}”.`;
}

export function createPerspectiveAutomaton(definition) {
	return new Automaton({
		id: `perspective-${definition.id}`,
		address: definition.address,
		structure: "trigram",
		activeLevels: [1, 2],
		functionalLevel: definition.functionalLevel,
		ports: [
			{ id: "context", direction: "input", type: "perspective-context", schemaVersion: "1" },
			{ id: "observation", direction: "output", type: "perspective-observation", schemaVersion: "1" },
		],
		metadata: {
			family: "morph-perspective",
			perspective: definition.label,
			independent: true,
		},
		implementation: (payload) => Object.freeze({
			id: definition.id,
			label: definition.label,
			prompt: definition.prompt,
			observation: observationFor(definition, payload),
		}),
	});
}

/**
 * ProportionOfPerspective mounts independent readers, then integrates their
 * outputs. No perspective owns the final answer.
 */
export class ProportionOfPerspective {
	constructor({ mesh } = {}) {
		if (!mesh) throw new TypeError("ProportionOfPerspective requires an AutomataMesh.");
		this.mesh = mesh;
		this.perspectives = PERSPECTIVE_DEFINITIONS.map((definition) => {
			const automaton = createPerspectiveAutomaton(definition);
			if (!mesh.automatons.has(automaton.id)) mesh.add(automaton);
			return mesh.automatons.get(automaton.id);
		});
	}

	async read({ text, semantic, history = [] }) {
		const payload = Object.freeze({ text, semantic, history: Object.freeze([...history]) });
		const observations = [];
		for (const automaton of this.perspectives) {
			observations.push(await automaton.call(payload));
		}
		const dimensionWeights = normalizedScores(
			PERSPECTIVE_DEFINITIONS,
			text,
			semantic,
			history,
		);
		const aspectWeights = normalizedScores(
			ASPECT_DEFINITIONS,
			text,
			semantic,
			history,
		);
		return Object.freeze({
			dimensions: dimensionWeights,
			aspects: aspectWeights,
			observations: Object.freeze(observations),
			integration: Object.freeze({
				id: "space",
				label: "Space / View",
				contributingPeer: false,
				note: "Rendered integration of the active dimensional readings.",
			}),
		});
	}
}

export { PERSPECTIVE_DEFINITIONS, ASPECT_DEFINITIONS };


import { GATE_DATA } from "../ato-core/gate-data.mjs";

function unique(values = []) {
	return Object.freeze([...new Set(values.filter((value) => value != null).map(String))]);
}

function normalizePrimitive(id, source = {}) {
	const gate = Number(id);
	if (!Number.isInteger(gate) || gate < 1 || gate > 64) {
		throw new RangeError(`Primitive id must be an integer from 1 to 64; received ${id}.`);
	}
	return Object.freeze({
		id: gate,
		name: String(source.name || `Primitive ${gate}`),
		meaning: source.keynote == null ? null : String(source.keynote),
		archetype: source.archetype == null ? null : String(source.archetype),
		circuit: source.circuit == null ? null : String(source.circuit),
		center: source.semanticCenter == null ? null : String(source.semanticCenter),
		aliases: unique(source.aliases || []),
		complements: Object.freeze([...(source.complements || [])]),
		channelPartners: Object.freeze([...(source.channels || [])]),
		examples: Object.freeze([...(source.examples || [])]),
		provenance: Object.freeze({
			source: source.provenance || "ato-core/gate-data.mjs",
			meaningResolved: source.keynote != null,
			complementResolved: Array.isArray(source.complements),
		}),
	});
}

/**
 * Finite 64-state primitive vocabulary.
 *
 * The current integrated gate table supplies the first worked vocabulary.
 * Unknown complements are kept unresolved rather than inferred from channel partners.
 */
export class PrimitiveLexicon {
	constructor({ basis = GATE_DATA } = {}) {
		this.byId = new Map();
		this.byAlias = new Map();

		for (let gate = 1; gate <= 64; gate += 1) {
			const primitive = normalizePrimitive(gate, basis[gate] || {});
			this.byId.set(gate, primitive);
			this.#index(primitive.name, gate);
			if (primitive.meaning) this.#index(primitive.meaning, gate);
			if (primitive.archetype) this.#index(primitive.archetype, gate);
			for (const alias of primitive.aliases) this.#index(alias, gate);
		}
	}

	#index(value, gate) {
		const key = String(value || "").trim().toLowerCase();
		if (!key) return;
		if (!this.byAlias.has(key)) this.byAlias.set(key, gate);
	}

	get(id) {
		const primitive = this.byId.get(Number(id));
		return primitive || null;
	}

	find(value) {
		if (Number.isInteger(Number(value)) && this.byId.has(Number(value))) {
			return this.byId.get(Number(value));
		}
		const text = String(value || "").trim().toLowerCase();
		if (!text) return null;
		const exact = this.byAlias.get(text);
		if (exact) return this.byId.get(exact);

		const candidates = [...this.byAlias.entries()]
			.filter(([alias]) => alias.length >= 4 && text.includes(alias))
			.sort((left, right) => right[0].length - left[0].length);
		return candidates.length ? this.byId.get(candidates[0][1]) : null;
	}

	teach(id, patch = {}) {
		const current = this.get(id);
		if (!current) throw new RangeError(`Unknown primitive: ${id}`);

		const next = Object.freeze({
			...current,
			name: patch.name == null ? current.name : String(patch.name),
			meaning:
				patch.meaning === undefined
					? current.meaning
					: patch.meaning == null
						? null
						: String(patch.meaning),
			aliases: unique([...(current.aliases || []), ...(patch.aliases || [])]),
			complements: Object.freeze(
				patch.complements === undefined
					? [...current.complements]
					: [...(patch.complements || [])],
			),
			examples: Object.freeze([
				...(current.examples || []),
				...(patch.examples || []),
			]),
			provenance: Object.freeze({
				...current.provenance,
				meaningResolved:
					patch.meaning === undefined
						? current.provenance.meaningResolved
						: patch.meaning != null,
				complementResolved:
					patch.complements === undefined
						? current.provenance.complementResolved
						: true,
				lastTeachingSource:
					patch.source == null
						? current.provenance.lastTeachingSource || null
						: String(patch.source),
			}),
		});
		this.byId.set(Number(id), next);
		this.#index(next.name, next.id);
		if (next.meaning) this.#index(next.meaning, next.id);
		for (const alias of next.aliases) this.#index(alias, next.id);
		return next;
	}

	list() {
		return Object.freeze([...this.byId.values()]);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.native-grammar.primitives.v1",
			size: this.byId.size,
			resolvedMeanings: this.list().filter((item) => item.provenance.meaningResolved).length,
			resolvedComplements: this.list().filter((item) => item.provenance.complementResolved).length,
		});
	}
}

export default new PrimitiveLexicon();

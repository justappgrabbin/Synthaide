
import { RELATIONSHIP_STATES } from "./constants.mjs";

function normalizedScale(value) {
	const number = Number(value);
	return Number.isFinite(number) ? Math.trunc(number) : null;
}

function relationState(type) {
	const normalized = String(type || "").trim().toLowerCase();
	if (["same", "identity", "resonance", "similar", "similarity"].includes(normalized)) {
		return RELATIONSHIP_STATES.RESONANCE;
	}
	if (["cross", "counterpart", "complement", "complementary", "harmony"].includes(normalized)) {
		return RELATIONSHIP_STATES.HARMONY;
	}
	return RELATIONSHIP_STATES.DISSONANCE;
}

function legalTouch(leftScale, rightScale, type) {
	const left = normalizedScale(leftScale);
	const right = normalizedScale(rightScale);
	if (left === null || right === null) return null;
	const delta = Math.abs(left - right);
	if (delta <= 1) return true;
	return ["cross", "counterpart", "complement", "complementary", "harmony"].includes(
		String(type || "").toLowerCase(),
	) && delta === 0;
}

export class RelationshipGrammar {
	classify(relation = {}) {
		const state = relationState(relation.type || relation.relation);
		return Object.freeze({
			from: relation.from ?? null,
			to: relation.to ?? null,
			type: String(relation.type || relation.relation || "other"),
			state,
			fromScale: relation.fromScale ?? null,
			toScale: relation.toScale ?? null,
			touchAllowed: legalTouch(
				relation.fromScale,
				relation.toScale,
				relation.type || relation.relation,
			),
			evidence: Object.freeze([...(relation.evidence || [])]),
		});
	}

	relate(located, relations = []) {
		return Object.freeze({
			located,
			relations: Object.freeze(relations.map((relation) => this.classify(relation))),
		});
	}
}

export default new RelationshipGrammar();


import { POSITION_ORDER, POSITION_ROLES } from "./constants.mjs";

function freezePosition(role, value, {
	label = null,
	resolved = value !== null && value !== undefined,
	evidence = [],
} = {}) {
	return Object.freeze({
		role,
		job: POSITION_ROLES[role].job,
		label: label || POSITION_ROLES[role].job,
		status: resolved ? "resolved" : "unresolved",
		value: resolved ? structuredClone(value) : null,
		evidence: Object.freeze([...evidence]),
	});
}

/**
 * The role jobs remain stable even when a domain gives those positions different names.
 */
export class PositionGrammar {
	locate(translation = {}) {
		const values = translation.positions || {};
		const labels = translation.positionLabels || {};
		const evidence = translation.positionEvidence || {};

		const positions = {};
		for (const role of POSITION_ORDER) {
			positions[role] = freezePosition(role, values[role], {
				label: labels[role],
				resolved: values[role] !== null && values[role] !== undefined,
				evidence: evidence[role] || [],
			});
		}

		return Object.freeze({
			domain: translation.domain || "generic",
			primitive: translation.primitive || null,
			positions: Object.freeze(positions),
			unresolved: Object.freeze(
				POSITION_ORDER.filter((role) => positions[role].status === "unresolved"),
			),
			context: Object.freeze({ ...(translation.context || {}) }),
		});
	}
}

export default new PositionGrammar();

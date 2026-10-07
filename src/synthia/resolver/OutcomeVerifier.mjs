import { difference, normalizeState } from "./ProblemSignature.mjs";

export class OutcomeVerifier {
	compare({
		before = [],
		after = [],
		desired = [],
		descriptor = null,
		evidence = null,
	} = {}) {
		const beforeState = normalizeState(before);
		const afterState = normalizeState(after);
		const desiredState = normalizeState(desired);
		const missing = difference(afterState, desiredState);
		const gained = afterState.filter((atom) => !beforeState.includes(atom));

		let status = "unresolved";
		if (desiredState.length && missing.length === 0) status = "supported";
		else if (desiredState.length && gained.length) status = "conditional";
		else if (desiredState.length && !gained.length) status = "contradicted";

		return Object.freeze({
			status,
			before: beforeState,
			after: afterState,
			desired: desiredState,
			missing,
			gained: Object.freeze(gained),
			componentId: descriptor?.componentId || null,
			address: descriptor?.address || null,
			evidence: evidence == null ? null : structuredClone(evidence),
		});
	}
}

export default OutcomeVerifier;

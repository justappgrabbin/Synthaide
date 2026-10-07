import { normalizeState } from "./ProblemSignature.mjs";

function list(value) {
	if (value == null) return Object.freeze([]);
	const source = Array.isArray(value) ? value : [value];
	return Object.freeze(
		[...new Set(source.map((item) => String(item).trim()).filter(Boolean))],
	);
}

function checked(value, fallback) {
	if (value === undefined || value === null) {
		return Object.freeze({ status: "unresolved", value: null });
	}
	return Object.freeze({ status: "checked", value: value ?? fallback });
}

function extractWhat(identity) {
	return identity?.what?.value || identity?.what || {};
}

function extractWhen(identity) {
	return identity?.when?.value || identity?.when || {};
}

function extractDependencies(identity) {
	const value = identity?.dependencies?.value ?? identity?.dependencies;
	return value == null ? [] : Array.isArray(value) ? value : [value];
}

function stateFrom(value) {
	if (value === undefined || value === null) return null;
	const normalized = normalizeState(value);
	return normalized.length ? normalized : [];
}

export class TransitionDescriptor {
	constructor({
		componentId,
		address,
		accepts = null,
		produces = null,
		solves = [],
		requires = [],
		triggers = [],
		contraindications = [],
		beforeState = null,
		afterState = null,
		scales = [],
		contexts = [],
		provenance = null,
	} = {}) {
		if (!componentId) throw new TypeError("TransitionDescriptor requires componentId.");
		if (!address) throw new TypeError("TransitionDescriptor requires a canonical address.");

		const normalizedBefore = stateFrom(beforeState ?? accepts);
		const normalizedAfter = stateFrom(afterState ?? produces);

		this.componentId = String(componentId);
		this.address = Object.freeze(structuredClone(address));
		this.accepts = checked(
			normalizedBefore === null ? null : normalizedBefore,
			[],
		);
		this.produces = checked(
			normalizedAfter === null ? null : normalizedAfter,
			[],
		);
		this.solves = Object.freeze(list(solves));
		this.requires = Object.freeze(list(requires));
		this.triggers = Object.freeze(list(triggers));
		this.contraindications = Object.freeze(list(contraindications));
		this.scales = Object.freeze(list(scales));
		this.contexts = Object.freeze(list(contexts));
		this.provenance = Object.freeze(structuredClone(provenance || {}));
		this.status =
			this.accepts.status === "checked" && this.produces.status === "checked"
				? "resolved"
				: "unresolved";
		Object.freeze(this);
	}

	toJSON() {
		return {
			componentId: this.componentId,
			address: this.address,
			accepts: this.accepts,
			produces: this.produces,
			solves: this.solves,
			requires: this.requires,
			triggers: this.triggers,
			contraindications: this.contraindications,
			scales: this.scales,
			contexts: this.contexts,
			provenance: this.provenance,
			status: this.status,
		};
	}
}

export function deriveTransitionDescriptor(identity, explicit = null) {
	if (!identity?.id || !identity?.address) {
		throw new TypeError("deriveTransitionDescriptor requires an addressed identity.");
	}

	const what = extractWhat(identity);
	const when = extractWhen(identity);
	const metadata = identity.metadata || {};
	const declared = explicit || metadata.transition || what.transition || {};

	const accepts =
		declared.accepts ??
		declared.beforeState ??
		what.accepts ??
		what.beforeState ??
		null;

	const produces =
		declared.produces ??
		declared.afterState ??
		what.produces ??
		what.afterState ??
		null;

	return new TransitionDescriptor({
		componentId: identity.id,
		address: identity.address,
		accepts,
		produces,
		solves: declared.solves ?? what.solves ?? [],
		requires:
			declared.requires ??
			what.requires ??
			extractDependencies(identity),
		triggers:
			declared.triggers ??
			what.triggers ??
			when.triggers ??
			(when.activation ? [when.activation] : []),
		contraindications:
			declared.contraindications ??
			what.contraindications ??
			when.contraindications ??
			[],
		scales: declared.scales ?? what.scales ?? [],
		contexts: declared.contexts ?? what.contexts ?? [],
		provenance: {
			source: "canonical-intake-derived-transition",
			identityProvenance: identity.provenance?.value || identity.provenance || {},
		},
	});
}

export default TransitionDescriptor;

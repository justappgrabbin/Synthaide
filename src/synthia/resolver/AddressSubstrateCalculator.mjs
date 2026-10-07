import { createDefaultSynthiaGrammar } from "../five-substrate/grammarKernel.mjs";
import { normalizeState } from "./ProblemSignature.mjs";
import KleinAddressCalculator from "./KleinAddressCalculator.mjs";

const SUBSTRATE_KEYS = Object.freeze({
	Movement: "mu",
	Evolution: "e",
	Being: "b",
	Design: "d",
	Space: "s",
});

const POSITION_FIELDS = Object.freeze([
	"planetary",
	"dimension",
	"gate",
	"line",
	"color",
	"tone",
	"base",
	"degree",
	"minute",
	"second",
	"arcAxis",
	"zodiac",
	"house",
]);

function clone(value) {
	return value == null ? value : structuredClone(value);
}

function transitionInputs(descriptor) {
	if (descriptor?.accepts?.status !== "checked") return [];
	return descriptor.accepts.value || [];
}

function transitionOutputs(descriptor) {
	if (descriptor?.produces?.status !== "checked") return [];
	return descriptor.produces.value || [];
}

function transitionRequirements(descriptor) {
	return [...new Set([
		...transitionInputs(descriptor),
		...(descriptor?.requires || []),
	])];
}

function compareAddresses(from, to) {
	const matched = [];
	const different = [];
	const compared = [];

	for (const field of POSITION_FIELDS) {
		const left = from?.[field];
		const right = to?.[field];
		if (left === undefined || left === null || right === undefined || right === null) continue;
		compared.push(field);
		if (String(left) === String(right)) matched.push(field);
		else different.push(field);
	}

	return Object.freeze({
		compared: Object.freeze(compared),
		matched: Object.freeze(matched),
		different: Object.freeze(different),
		affinity: compared.length ? matched.length / compared.length : 0,
	});
}

function historyForKernel(history) {
	return (history || []).map((record, index) => ({
		eventId: record?.eventId || record?.id || `transition-history-${index + 1}`,
		status: record?.status || null,
	}));
}

/**
 * Calculation-only bridge.
 *
 * It does not replace canonical addressing, DEG, Geo-DEG, Native Grammar,
 * or TransitionResolver. It gives TransitionResolver a deterministic
 * five-substrate reading of an already-addressed transition candidate.
 */
export class AddressSubstrateCalculator {
	constructor({ grammar = createDefaultSynthiaGrammar(), klein = new KleinAddressCalculator() } = {}) {
		this.id = "synthia-address-substrate-calculator";
		this.grammar = grammar;
		this.klein = klein;

		this.grammar
			.registerRewrite(
				"apply-addressed-transition",
				(_state, action) =>
					action?.type === "apply-addressed-transition"
					&& Boolean(action?.candidate),
				(x, action) => [
					...new Set([
						...normalizeState(x),
						...normalizeState(action.candidate.produces || []),
					]),
				],
				1000,
			)
			.registerConstraint(
				"transition-requirements-satisfied",
				(xCandidate, context, state) => {
					const required = normalizeState(context.transitionRequirements || []);
					const current = new Set(normalizeState(state.x));
					return {
						passed: required.every((atom) => current.has(atom)),
						required,
						candidateState: normalizeState(xCandidate),
					};
				},
				1000,
			)
			.registerInterpreter(
				"canonical-address-position",
				(x, context) => ({
					state: normalizeState(x),
					position: clone(context.position),
					desired: normalizeState(context.desired || []),
					componentId: context.componentId || null,
					klein: clone(context.klein?.source || null),
				}),
				1000,
			)
			.registerRelation(
				"canonical-address-relation",
				(self, other) => {
					const from = self.c?.position || null;
					const to = other?.c?.position || self.c?.candidateAddress || null;
					return {
						from: clone(from),
						to: clone(to),
						...compareAddresses(from, to),
						klein: clone(self.c?.klein?.transition || null),
					};
				},
				1000,
			);
	}

	calculate({
		current = [],
		desired = [],
		address = null,
		candidate = null,
		context = {},
		history = [],
	} = {}) {
		const candidateAddress = candidate?.address || null;
		const requirements = transitionRequirements(candidate);
		const produces = transitionOutputs(candidate);
		const position = address || candidateAddress || null;
		const klein = this.klein.calculate(position, candidateAddress || position);
		const dimension =
			position?.dimension
			|| position?.planetaryDimension
			|| candidateAddress?.dimension
			|| candidateAddress?.planetaryDimension
			|| null;

		const state = this.grammar.createState({
			x: normalizeState(current),
			r: {
				type: "addressed-transition",
				from: clone(position),
				to: clone(candidateAddress),
			},
			c: {
				...clone(context),
				position: clone(position),
				candidateAddress: clone(candidateAddress),
				componentId: candidate?.componentId || null,
				desired: normalizeState(desired),
				transitionRequirements: requirements,
				klein,
			},
			h: historyForKernel(history),
		});

		const event = {
			action: {
				type: "apply-addressed-transition",
				candidate: {
					componentId: candidate?.componentId || null,
					produces,
				},
			},
			perspective: "transition",
			relationType: "canonical-address",
			otherState: candidateAddress
				? {
					x: produces,
					r: { type: "candidate-destination" },
					c: {
						position: clone(candidateAddress),
						perspective: "destination",
					},
					h: [],
				}
				: null,
		};

		const projections = this.grammar.project(state, event);
		const primaryKey = SUBSTRATE_KEYS[dimension] || null;
		const relation = projections.s?.resolvedRelation || compareAddresses(position, candidateAddress);

		return Object.freeze({
			version: "synthia.address-substrate-calculation.v1",
			position: clone(position),
			candidateAddress: clone(candidateAddress),
			primarySubstrate: dimension,
			primaryProjection: primaryKey ? projections[primaryKey] : null,
			permitted: projections.d.valid,
			addressAffinity: Number(relation?.affinity || 0),
			addressRelation: clone(relation),
			klein,
			projections,
		});
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.address-substrate-calculator.v2",
			substrates: Object.freeze(Object.keys(SUBSTRATE_KEYS)),
			klein: this.klein.snapshot(),
		});
	}
}

export default AddressSubstrateCalculator;

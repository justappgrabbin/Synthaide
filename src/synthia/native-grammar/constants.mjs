
export const POSITION_ROLES = Object.freeze({
	P: Object.freeze({
		id: "P",
		job: "source-primitive",
		description: "Identifies the source or primitive basis participating in the state.",
	}),
	D: Object.freeze({
		id: "D",
		job: "domain-dimension",
		description: "Identifies the domain or dimensional perspective through which the state is being represented.",
	}),
	G: Object.freeze({
		id: "G",
		job: "semantic-state",
		description: "Identifies the semantic state currently occupied.",
	}),
	L: Object.freeze({
		id: "L",
		job: "expression-behavior",
		description: "Identifies how the semantic state is expressed or behaves.",
	}),
	C: Object.freeze({
		id: "C",
		job: "motivation-constraint",
		description: "Identifies the motivating or constraining condition.",
	}),
	T: Object.freeze({
		id: "T",
		job: "perception-sense",
		description: "Identifies the perceptual or sensing mode through which the state is encountered.",
	}),
	B: Object.freeze({
		id: "B",
		job: "underlying-orientation",
		description: "Identifies the underlying orientation or ground condition.",
	}),
});

export const POSITION_ORDER = Object.freeze(["P", "D", "G", "L", "C", "T", "B"]);

export const RELATIONSHIP_STATES = Object.freeze({
	RESONANCE: "resonance",
	HARMONY: "harmony",
	DISSONANCE: "dissonance",
});

export const SCALE_OPERATIONS = Object.freeze([
	"FOLD",
	"UNFOLD",
	"UP",
	"DOWN",
	"CROSS",
	"PIVOT",
]);

export const REALITY_STATUSES = Object.freeze([
	"supported",
	"conditional",
	"contradicted",
	"unresolved",
]);

export const UNDERSTANDING_STEPS = Object.freeze([
	"translate",
	"locate",
	"relate",
	"scale",
	"test",
	"remember",
]);

export const DEFAULT_SCALE_LADDER = Object.freeze([
	"feature",
	"phoneme",
	"grapheme",
	"morpheme",
	"word",
	"phrase",
	"clause",
	"sentence",
	"discourse",
	"automaton",
	"mesh",
]);

const REACTIONS = [
	{ reactants: ["HCl", "NaOH"], products: ["NaCl", "H2O"], equation: "HCl + NaOH -> NaCl + H2O", type: "neutralization", resultingPh: 7, tempDelta: 15 },
	{ reactants: ["Na", "H2O"], products: ["NaOH", "H2"], equation: "2Na + 2H2O -> 2NaOH + H2", type: "redox", resultingPh: 13, tempDelta: 60, hazards: ["flammable-hydrogen", "violent-reaction"] },
	{ reactants: ["CuSO4", "NaOH"], products: ["Cu(OH)2", "Na2SO4"], equation: "CuSO4 + 2NaOH -> Cu(OH)2 + Na2SO4", type: "precipitation", resultingPh: 9, effects: ["blue-precipitate"] },
	{ reactants: ["HCl", "CaCO3"], products: ["CaCl2", "H2O", "CO2"], equation: "CaCO3 + 2HCl -> CaCl2 + H2O + CO2", type: "gas-evolution", resultingPh: 5, effects: ["bubbles"] },
];

const key = values => [...new Set(values)].sort().join("|");
const INDEX = new Map(REACTIONS.map(reaction => [key(reaction.reactants), Object.freeze(reaction)]));

export function simulateReaction(reactants, state = {}) {
	if (!Array.isArray(reactants) || reactants.length < 2) throw new TypeError("reactants must contain at least two chemicals");
	const reaction = INDEX.get(key(reactants));
	if (!reaction) return { matched: false, reactants: [...reactants], state: { ...state }, reason: "no-verified-reaction" };
	return { matched: true, ...reaction, reactants: [...reactants], state: { ...state, ph: reaction.resultingPh, temperatureC: (state.temperatureC ?? 20) + (reaction.tempDelta ?? 0) } };
}

export function listVerifiedReactions() { return REACTIONS.map(reaction => ({ ...reaction })); }

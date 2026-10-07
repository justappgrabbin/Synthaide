
import { StateSpaceKernel } from "./ato-core/state-space-kernel.mjs";
import { canonicalAddress } from "./ato-core/address-space.mjs";

export const DIMENSIONS = Object.freeze([
	"Movement",
	"Evolution",
	"Being",
	"Design",
	"Space",
]);

export const ADDRESS_FIELDS = Object.freeze([
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

const PLANETS = Object.freeze([
	"Sun", "Earth", "Moon", "NorthNode", "SouthNode", "Mercury", "Venus",
	"Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
]);
const ZODIAC = Object.freeze([
	"Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
	"Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]);

function contextualProjection(macro) {
	const gate = macro.gate;
	const line = macro.line;
	const color = macro.color;
	const tone = macro.tone;
	const base = macro.base;
	const seed = gate * 31 + line * 17 + color * 13 + tone * 7 + base * 5;
	return Object.freeze({
		planetary: PLANETS[(gate + line - 2) % PLANETS.length],
		dimension: DIMENSIONS[(gate + color - 2) % DIMENSIONS.length],
		gate,
		line,
		color,
		tone,
		base,
		degree: seed % 360,
		minute: (seed * 7 + gate) % 60,
		second: (seed * 13 + line) % 60,
		arcAxis: seed % 2 === 0 ? "Asc" : "Desc",
		zodiac: ZODIAC[(gate + tone - 2) % ZODIAC.length],
		house: ((gate + base - 2) % 12) + 1,
	});
}

/**
 * Single address authority for Synthia.
 *
 * The ATO StateSpaceKernel resolves the semantic cue to a canonical macro
 * address. The legacy 13-field shape is only a contextual projection of that
 * address and never performs a second text hash.
 */
export class CanonicalStateAuthority {
	constructor({ kernel = new StateSpaceKernel() } = {}) {
		this.kernel = kernel;
		this.history = [];
	}

	resolve(input, overrides = {}) {
		const description = this.kernel.describe(String(input));
		const macro = description.candidates[0]?.state?.address;
		if (!macro) throw new Error("ATO state kernel could not resolve a state.");
		return Object.freeze({
			...contextualProjection(macro),
			...overrides,
		});
	}

	commit(kind, payload, overrides = {}) {
		const input = typeof payload === "string" ? payload : JSON.stringify(payload);
		const address = this.resolve(input, overrides);
		const macro = {
			mode: "macro",
			gate: address.gate,
			line: address.line,
			color: address.color,
			tone: address.tone,
			base: address.base,
		};
		this.kernel.annotate(macro, "inference", {
			kind,
			payload: structuredClone(payload),
		}, "synthia.canonical-state-authority");
		const record = Object.freeze({
			id: `state-${this.history.length + 1}`,
			kind,
			payload: structuredClone(payload),
			address,
			addressKey: canonicalAddress(macro),
			createdAt: new Date().toISOString(),
		});
		this.history.push(record);
		return record;
	}

	format(address) {
		return `${address.planetary}:${address.dimension}:G${address.gate}.L${address.line}.C${address.color}.T${address.tone}.B${address.base}:${address.degree}°${address.minute}′${address.second}″:${address.arcAxis}:${address.zodiac}:H${address.house}`;
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.canonical-state-authority.v1",
			history: Object.freeze([...this.history]),
			kernelStates: this.kernel.states.size,
			kernelAnnotations: this.kernel.annotations.size,
		});
	}
}

export default new CanonicalStateAuthority();

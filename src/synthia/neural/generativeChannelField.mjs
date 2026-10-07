// Browser-native extraction of Generative-Process-Cluster's morphing engine.
// The donor's exact channel list is preserved separately. The active runtime
// can be given a different verified channel graph without changing the donor
// definition or the bigram/trigram/hexagram/channel/emergence operators.

import { CHANNEL_EDGES as TRAINED_HD_CHANNEL_EDGES } from "./humanDesignGNN.mjs";

export const HEXAGRAMS = Object.freeze({
	1: "111111", 2: "000000", 3: "100010", 4: "010001",
	5: "111010", 6: "010111", 7: "010000", 8: "000010",
	9: "111011", 10: "110111", 11: "111000", 12: "000111",
	13: "101111", 14: "111101", 15: "001000", 16: "000100",
	17: "100110", 18: "011001", 19: "110000", 20: "000011",
	21: "100101", 22: "101001", 23: "000001", 24: "100000",
	25: "100111", 26: "111001", 27: "100001", 28: "011110",
	29: "010010", 30: "101101", 31: "001110", 32: "011100",
	33: "001111", 34: "111100", 35: "000101", 36: "101000",
	37: "101011", 38: "110101", 39: "001010", 40: "010100",
	41: "110001", 42: "100011", 43: "111110", 44: "011111",
	45: "000110", 46: "011000", 47: "010110", 48: "011010",
	49: "101110", 50: "011101", 51: "100100", 52: "001001",
	53: "001011", 54: "110100", 55: "101100", 56: "001101",
	57: "011011", 58: "110110", 59: "010011", 60: "110010",
	61: "110011", 62: "001100", 63: "101010", 64: "010101",
});

export const TRIGRAM_NAMES = Object.freeze({
	0: "Earth",
	1: "Mountain",
	2: "Water",
	3: "Wind",
	4: "Thunder",
	5: "Fire",
	6: "Lake",
	7: "Heaven",
});

// Exact Generative-Process-Cluster donor list: 34 entries, including the
// orientation duplicate 26-44 / 44-26. It remains available for replay.
export const PROCESS_CHANNEL_PAIRS = Object.freeze([
	[1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59],
	[7, 31], [9, 52], [10, 20], [11, 56], [12, 22], [13, 33],
	[16, 48], [17, 62], [18, 58], [19, 49], [21, 45], [23, 43],
	[24, 61], [25, 51], [26, 44], [27, 50], [28, 38], [29, 46],
	[30, 41], [32, 54], [34, 20], [34, 57], [35, 36], [37, 40],
	[39, 55], [42, 53], [44, 26], [47, 64],
].map((pair) => Object.freeze(pair)));

export const CHANNEL_NAMES = Object.freeze({
	"1-8": "Inspiration",
	"2-14": "Beat",
	"3-60": "Mutation",
	"4-63": "Logic",
	"5-15": "Rhythm",
	"6-59": "Mating",
	"7-31": "Alpha",
	"9-52": "Concentration",
	"10-20": "Awakening",
	"11-56": "Curiosity",
	"12-22": "Openness",
	"13-33": "Prodigal",
	"16-48": "Wavelength",
	"17-62": "Acceptance",
	"18-58": "Judgment",
	"19-49": "Synthesis",
	"21-45": "Money Line",
	"23-43": "Structuring",
	"24-61": "Awareness",
	"25-51": "Initiation",
	"26-44": "Surrender",
	"27-50": "Preservation",
	"28-38": "Struggle",
	"29-46": "Discovery",
	"30-41": "Recognition",
	"32-54": "Transformation",
	"20-34": "Charisma",
	"34-57": "Power",
	"35-36": "Transitoriness",
	"37-40": "Community",
	"39-55": "Emoting",
	"42-53": "Maturation",
	"47-64": "Abstraction",
});

function pairKey(left, right) {
	return `${Math.min(left, right)}-${Math.max(left, right)}`;
}

export function getChannelName(left, right) {
	return CHANNEL_NAMES[pairKey(left, right)] || `Gate ${left}/${right}`;
}

export function xorBinary(left, right) {
	return left
		.split("")
		.map((bit, index) => String(Number(bit) ^ Number(right[index])))
		.join("");
}

export function binaryToGateNumber(binary) {
	for (const [gate, value] of Object.entries(HEXAGRAMS)) {
		if (value === binary) return Number(gate);
	}
	return null;
}

export function buildGateData(gateNumber) {
	const gate = Math.trunc(Number(gateNumber));
	const binary = HEXAGRAMS[gate];
	if (!binary) throw new RangeError(`Invalid gate number: ${gateNumber}`);
	const upperBits = binary.slice(0, 3);
	const lowerBits = binary.slice(3);
	const upperTrigram = Number.parseInt(upperBits, 2);
	const lowerTrigram = Number.parseInt(lowerBits, 2);
	return Object.freeze({
		gateNumber: gate,
		binaryState: binary,
		upperTrigram,
		lowerTrigram,
		upperTrigramName: TRIGRAM_NAMES[upperTrigram],
		lowerTrigramName: TRIGRAM_NAMES[lowerTrigram],
	});
}

export function levelToPhase(level) {
	const value = Math.max(0, Math.trunc(Number(level) || 0));
	if (value <= 2) return "bigram";
	if (value <= 5) return "trigram";
	if (value <= 8) return "hexagram";
	if (value <= 11) return "channel";
	return "transcendent";
}

export function computeBigramValue(gateNumber, description = "") {
	const raw = (Number(gateNumber) + String(description).length) % 4;
	return Math.trunc(raw).toString(2).padStart(2, "0");
}

export function computeChannels(
	gates,
	channelPairs = PROCESS_CHANNEL_PAIRS,
) {
	const levelByGate = new Map(
		gates.map((gate) => [Number(gate.gateNumber), Number(gate.level) || 0]),
	);
	const binaryByGate = new Map(
		gates.map((gate) => [
			Number(gate.gateNumber),
			gate.binaryState || HEXAGRAMS[gate.gateNumber],
		]),
	);

	return channelPairs.map(([gateA, gateB]) => {
		const levelA = levelByGate.get(gateA) || 0;
		const levelB = levelByGate.get(gateB) || 0;
		const binaryA = binaryByGate.get(gateA) || HEXAGRAMS[gateA] || "000000";
		const binaryB = binaryByGate.get(gateB) || HEXAGRAMS[gateB] || "000000";
		const edgeOutput = xorBinary(binaryA, binaryB);
		let status = "potential";
		if (levelA >= 4 && levelB >= 4) status = "active";
		if (levelA >= 9 && levelB >= 9) status = "firing";
		return Object.freeze({
			gateA,
			gateB,
			gateALevel: levelA,
			gateBLevel: levelB,
			status,
			edgeOutput,
			edgeOutputGate: binaryToGateNumber(edgeOutput),
			channelName: getChannelName(gateA, gateB),
		});
	});
}

export function detectEmergent(channels, existingSharedGates = new Set()) {
	const active = channels.filter(
		(channel) => channel.status === "active" || channel.status === "firing",
	);
	for (let left = 0; left < active.length; left += 1) {
		for (let right = left + 1; right < active.length; right += 1) {
			const channelA = active[left];
			const channelB = active[right];
			const first = new Set([channelA.gateA, channelA.gateB]);
			const shared = [channelB.gateA, channelB.gateB].find((gate) =>
				first.has(gate),
			);
			if (shared === undefined || existingSharedGates.has(shared)) continue;

			const averageLevel =
				(
					channelA.gateALevel +
					channelA.gateBLevel +
					channelB.gateALevel +
					channelB.gateBLevel
				) / 4;
			const type = averageLevel >= 9 ? "messi" : "auto-novel";
			return Object.freeze({
				type,
				channelA: Object.freeze([channelA.gateA, channelA.gateB]),
				channelB: Object.freeze([channelB.gateA, channelB.gateB]),
				sharedGate: shared,
				averageLevel,
				description:
					type === "messi"
						? `High-flow junction at Gate ${shared} between ${channelA.channelName} and ${channelB.channelName}.`
						: `Novel generative junction at Gate ${shared} between ${channelA.channelName} and ${channelB.channelName}.`,
			});
		}
	}
	return null;
}

export class GenerativeChannelRuntime {
	constructor({
		channelPairs = TRAINED_HD_CHANNEL_EDGES,
	} = {}) {
		this.id = "generative-channel-field";
		this.address = Object.freeze({ gate: 59, line: 1, color: 1, tone: 1, base: 1 });
		this.metadata = Object.freeze({
			capabilities: Object.freeze([
				"emergence.bigram",
				"emergence.trigram",
				"emergence.hexagram",
				"emergence.channel",
				"emergence.junction",
			]),
			lineage: "Generative-Process-Cluster",
			activeChannelGraph:
				channelPairs === TRAINED_HD_CHANNEL_EDGES
					? "Neural-Network-Builder-36-edge"
					: "custom",
			donorChannelCount: PROCESS_CHANNEL_PAIRS.length,
		});
		this.channelPairs = channelPairs.map((pair) => [...pair]);
		this.gates = Array.from({ length: 64 }, (_, index) => ({
			...buildGateData(index + 1),
			level: 0,
			bigrams: [],
			observations: 0,
		}));
		this.sharedGates = new Set();
		this.emergents = [];
		this.sequence = 0;
	}

	observeGate(gateNumber, {
		delta = 1,
		description = "",
		evidence = null,
	} = {}) {
		const gate = Math.min(64, Math.max(1, Math.trunc(Number(gateNumber) || 1)));
		const state = this.gates[gate - 1];
		const previous = state.level;
		state.level = Math.max(0, Math.min(12, previous + Number(delta || 0)));
		state.observations += 1;
		if (delta > 0) {
			state.bigrams.push(computeBigramValue(gate, description));
			state.bigrams = state.bigrams.slice(-12);
		}

		const channels = computeChannels(this.gates, this.channelPairs);
		const emergent = detectEmergent(channels, this.sharedGates);
		if (emergent) {
			this.sharedGates.add(emergent.sharedGate);
			this.emergents.push({
				...emergent,
				sequence: ++this.sequence,
				evidence,
			});
		}

		return Object.freeze({
			gate,
			previousLevel: previous,
			level: state.level,
			phase: levelToPhase(state.level),
			binary: state.binaryState,
			bigrams: Object.freeze([...state.bigrams]),
			channels: Object.freeze(
				channels.filter(
					(channel) =>
						channel.gateA === gate || channel.gateB === gate,
				),
			),
			emergent,
		});
	}


	observeOutcome({ address = {}, quality = 0, evidence = null } = {}) {
		const numericQuality = Number(quality) || 0;
		const delta = numericQuality > 0.25 ? 1 : numericQuality < 0 ? -1 : 0;
		if (delta === 0) {
			return Object.freeze({
				gate: Math.min(64, Math.max(1, Math.trunc(Number(address.gate) || 1))),
				delta: 0,
				reason: "neutral-outcome",
			});
		}
		return this.observeGate(address.gate, {
			delta,
			description: "verified runtime outcome",
			evidence,
		});
	}

	async call(input = {}) {
		const operation = input.operation || input.op || "observe";
		if (operation === "observe") {
			return this.observeGate(input.gate, input);
		}
		if (operation === "channels") {
			return Object.freeze(computeChannels(this.gates, this.channelPairs));
		}
		if (operation === "gate") {
			const gate = Math.min(64, Math.max(1, Math.trunc(Number(input.gate) || 1)));
			const state = this.gates[gate - 1];
			return Object.freeze({
				...state,
				bigrams: Object.freeze([...state.bigrams]),
				phase: levelToPhase(state.level),
			});
		}
		throw new Error(`Unsupported GenerativeChannel operation: ${operation}`);
	}

	snapshot() {
		const channels = computeChannels(this.gates, this.channelPairs);
		return Object.freeze({
			id: this.id,
			channelCount: this.channelPairs.length,
			activeChannels: channels.filter((channel) => channel.status === "active").length,
			firingChannels: channels.filter((channel) => channel.status === "firing").length,
			emergents: Object.freeze(this.emergents.map((entry) => Object.freeze({ ...entry }))),
			gateLevels: Object.freeze(this.gates.map((gate) => gate.level)),
			metadata: this.metadata,
		});
	}
}

export default new GenerativeChannelRuntime();

// Browser-native inference port of the trained Human Design GraphSAGE donor.
// Source lineage: Neural-Network-Builder/ml/model/{graph.py,gnn.py}.
// The trained checkpoint used synthetic/rule-supervised labels; this module
// reproduces its learned inference math and does not upgrade those labels into
// empirical claims.

import WEIGHTS, { TRAINING_METADATA } from "./humanDesignGNNWeights.mjs";

export const PLANETS = Object.freeze([
	"Sun", "Earth", "Moon", "Mercury", "Venus", "Mars",
	"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
	"North Node", "South Node",
]);

export const CHANNEL_EDGES = Object.freeze([
	[1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59], [7, 31],
	[9, 52], [10, 20], [10, 34], [10, 57], [11, 56], [12, 22], [13, 33],
	[16, 48], [17, 62], [18, 58], [19, 49], [20, 34], [20, 57], [21, 45],
	[23, 43], [24, 61], [25, 51], [26, 44], [27, 50], [28, 38], [29, 46],
	[30, 41], [32, 54], [34, 57], [35, 36], [37, 40], [39, 55], [42, 53],
	[47, 64],
].map((edge) => Object.freeze(edge)));

export const AWARENESS_SETS = Object.freeze({
	spleen: Object.freeze([57, 44, 50, 32, 28, 18]),
	ajna: Object.freeze([47, 24, 4, 17, 11, 43]),
	solar_plexus: Object.freeze([55, 49, 37, 22, 30, 36, 6]),
	heart: Object.freeze([21, 51, 26, 40]),
	mind: Object.freeze([47, 24, 4, 17, 11, 43]),
});

const INPUT_DIM = 34;
const HIDDEN_DIM = 64;
const SUN_ENCODING_DIM = 70;
const LAYER_NORM_EPS = 1e-5;
const PLANET_INDEX = new Map(PLANETS.map((planet, index) => [planet, index]));

function sigmoid(value) {
	const clamped = Math.max(-60, Math.min(60, Number(value) || 0));
	return 1 / (1 + Math.exp(-clamped));
}

function relu(value) {
	return Math.max(0, value);
}

function dot(left, right) {
	let sum = 0;
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		sum += left[index] * right[index];
	}
	return sum;
}

function linearVector(input, weight, bias) {
	return weight.map((row, index) => dot(row, input) + (bias[index] ?? 0));
}

function linearRows(rows, weight, bias) {
	return rows.map((row) => linearVector(row, weight, bias));
}

function addRows(left, right, bias) {
	return left.map((row, rowIndex) =>
		row.map((value, columnIndex) =>
			value + right[rowIndex][columnIndex] + (bias[columnIndex] ?? 0),
		),
	);
}

function layerNorm(row, weight, bias) {
	const mean = row.reduce((sum, value) => sum + value, 0) / row.length;
	const variance =
		row.reduce((sum, value) => sum + (value - mean) ** 2, 0) / row.length;
	const inverseStd = 1 / Math.sqrt(variance + LAYER_NORM_EPS);
	return row.map(
		(value, index) =>
			(value - mean) * inverseStd * weight[index] + bias[index],
	);
}

function softmax(values) {
	const maximum = Math.max(...values);
	const exponentials = values.map((value) => Math.exp(value - maximum));
	const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
	return exponentials.map((value) => value / total);
}

function zeroMatrix(rows, columns) {
	return Array.from({ length: rows }, () => new Array(columns).fill(0));
}

function validatePlacement(placement) {
	const gate = Math.trunc(Number(placement?.gate));
	const line = Math.trunc(Number(placement?.line));
	if (gate < 1 || gate > 64) {
		throw new RangeError(`Human Design placement gate must be 1-64; got ${placement?.gate}`);
	}
	if (line < 1 || line > 6) {
		throw new RangeError(`Human Design placement line must be 1-6; got ${placement?.line}`);
	}
	return {
		planet: String(placement?.planet || "Sun"),
		stream: String(placement?.stream || "body").toLowerCase() === "body"
			? "body"
			: "design",
		gate,
		line,
	};
}

export function buildNodeFeatures(placements = []) {
	const features = zeroMatrix(64, INPUT_DIM);
	const activated = new Set();

	for (const raw of placements) {
		const placement = validatePlacement(raw);
		const gateIndex = placement.gate - 1;
		const planetIndex = PLANET_INDEX.get(placement.planet) ?? 0;
		activated.add(placement.gate);

		if (placement.stream === "body") {
			features[gateIndex][planetIndex] = 1;
		} else {
			features[gateIndex][PLANETS.length + planetIndex] = 1;
		}
		features[gateIndex][26 + placement.line - 1] = 1;
		features[gateIndex][32] = 1;
	}

	for (const [left, right] of CHANNEL_EDGES) {
		if (activated.has(left) && activated.has(right)) {
			features[left - 1][33] = 1;
			features[right - 1][33] = 1;
		}
	}
	return features;
}

export function findBodySun(placements = []) {
	for (const raw of placements) {
		const placement = validatePlacement(raw);
		if (placement.planet === "Sun" && placement.stream === "body") {
			return Object.freeze({ gate: placement.gate, line: placement.line });
		}
	}
	return Object.freeze({ gate: 1, line: 1 });
}

export function buildSunEncoding(gate, line) {
	const safeGate = Math.min(64, Math.max(1, Math.trunc(Number(gate) || 1)));
	const safeLine = Math.min(6, Math.max(1, Math.trunc(Number(line) || 1)));
	const encoding = new Array(SUN_ENCODING_DIM).fill(0);
	encoding[safeGate - 1] = 1;
	encoding[64 + safeLine - 1] = 1;
	return encoding;
}

const NEIGHBORS = (() => {
	const neighbors = Array.from({ length: 64 }, () => []);
	for (const [left, right] of CHANNEL_EDGES) {
		neighbors[left - 1].push(right - 1);
		neighbors[right - 1].push(left - 1);
	}
	return neighbors.map((list) => Object.freeze([...list]));
})();

function graphSageLayer(rows, layerIndex) {
	const prefix = `conv_layers.${layerIndex}`;
	const selfWeight = WEIGHTS[`${prefix}.lin_self.weight`];
	const neighborWeight = WEIGHTS[`${prefix}.lin_neigh.weight`];
	const bias = WEIGHTS[`${prefix}.bias`];

	const neighborMeans = rows.map((_, nodeIndex) => {
		const neighbors = NEIGHBORS[nodeIndex];
		if (!neighbors.length) return new Array(HIDDEN_DIM).fill(0);
		const mean = new Array(HIDDEN_DIM).fill(0);
		for (const neighborIndex of neighbors) {
			const neighbor = rows[neighborIndex];
			for (let feature = 0; feature < HIDDEN_DIM; feature += 1) {
				mean[feature] += neighbor[feature];
			}
		}
		for (let feature = 0; feature < HIDDEN_DIM; feature += 1) {
			mean[feature] /= neighbors.length;
		}
		return mean;
	});

	const selfProjected = linearRows(rows, selfWeight, new Array(HIDDEN_DIM).fill(0));
	const neighborProjected = linearRows(
		neighborMeans,
		neighborWeight,
		new Array(HIDDEN_DIM).fill(0),
	);
	return addRows(selfProjected, neighborProjected, bias);
}

function awarenessScore(rows, name) {
	const mask = new Set(AWARENESS_SETS[name]);
	const prefix = name === "solar_plexus"
		? "solar_head"
		: name === "heart"
			? "heart_base"
			: name === "mind"
				? "mind_base"
				: `${name}_head`;

	const attention0Weight = WEIGHTS[`${prefix}.attention.0.weight`];
	const attention0Bias = WEIGHTS[`${prefix}.attention.0.bias`];
	const attention2Weight = WEIGHTS[`${prefix}.attention.2.weight`];
	const attention2Bias = WEIGHTS[`${prefix}.attention.2.bias`];
	const outputWeight = WEIGHTS[`${prefix}.output.weight`];
	const outputBias = WEIGHTS[`${prefix}.output.bias`];

	const scores = rows.map((row, index) => {
		const gate = index + 1;
		const masked = mask.has(gate) ? row : new Array(HIDDEN_DIM).fill(0);
		const hidden = linearVector(masked, attention0Weight, attention0Bias).map(Math.tanh);
		const score = linearVector(hidden, attention2Weight, attention2Bias)[0];
		return mask.has(gate) ? score : score - 1e9;
	});
	const attention = softmax(scores);
	const pooled = new Array(HIDDEN_DIM).fill(0);
	for (let nodeIndex = 0; nodeIndex < rows.length; nodeIndex += 1) {
		if (!mask.has(nodeIndex + 1)) continue;
		const row = rows[nodeIndex];
		for (let feature = 0; feature < HIDDEN_DIM; feature += 1) {
			pooled[feature] += attention[nodeIndex] * row[feature];
		}
	}
	return sigmoid(linearVector(pooled, outputWeight, outputBias)[0]);
}

function filmScore(baseScore, sunEncoding, name) {
	const prefix = `${name}_film.mlp`;
	const hidden = linearVector(
		sunEncoding,
		WEIGHTS[`${prefix}.0.weight`],
		WEIGHTS[`${prefix}.0.bias`],
	).map(relu);
	const [gamma, beta] = linearVector(
		hidden,
		WEIGHTS[`${prefix}.2.weight`],
		WEIGHTS[`${prefix}.2.bias`],
	);
	return sigmoid(gamma * baseScore + beta);
}

export function inferHumanDesignGNN(placements = []) {
	const features = buildNodeFeatures(placements);
	const sun = findBodySun(placements);
	const sunEncoding = buildSunEncoding(sun.gate, sun.line);

	let rows = linearRows(
		features,
		WEIGHTS["input_proj.weight"],
		WEIGHTS["input_proj.bias"],
	).map((row) => row.map(relu));

	for (let layerIndex = 0; layerIndex < 3; layerIndex += 1) {
		let update = graphSageLayer(rows, layerIndex);
		update = update.map((row) =>
			layerNorm(
				row,
				WEIGHTS[`layer_norms.${layerIndex}.weight`],
				WEIGHTS[`layer_norms.${layerIndex}.bias`],
			).map(relu),
		);
		rows = rows.map((row, nodeIndex) =>
			row.map((value, feature) => value + update[nodeIndex][feature]),
		);
	}

	const codons = rows.map((row) =>
		sigmoid(
			dot(WEIGHTS["codon_head.weight"][0], row) +
				WEIGHTS["codon_head.bias"][0],
		),
	);
	const spleen = awarenessScore(rows, "spleen");
	const ajna = awarenessScore(rows, "ajna");
	const solarPlexus = awarenessScore(rows, "solar_plexus");
	const heartBase = awarenessScore(rows, "heart");
	const mindBase = awarenessScore(rows, "mind");
	const heart = filmScore(heartBase, sunEncoding, "heart");
	const mind = filmScore(mindBase, sunEncoding, "mind");

	return Object.freeze({
		codons: Object.freeze(codons),
		spleen,
		ajna,
		solarPlexus,
		heart,
		mind,
		bodySun: sun,
	});
}

export class HumanDesignGNNRuntime {
	constructor() {
		this.id = "human-design-gnn";
		this.address = Object.freeze({ gate: 64, line: 1, color: 1, tone: 1, base: 1 });
		this.metadata = Object.freeze({
			capabilities: Object.freeze([
				"neural.human-design.infer",
				"neural.gate.activation",
				"neural.channel.message-passing",
			]),
			lineage: "Neural-Network-Builder",
			model: "GraphSAGE-3-layer",
			training: TRAINING_METADATA,
		});
		this.calls = 0;
		this.last = null;
	}

	async call(input = {}) {
		const operation = input.operation || input.op || "infer";
		if (operation !== "infer") {
			throw new Error(`Unsupported HumanDesignGNN operation: ${operation}`);
		}
		const placements = Array.isArray(input.placements) ? input.placements : [];
		const output = inferHumanDesignGNN(placements);
		this.calls += 1;
		this.last = output;
		return output;
	}

	snapshot() {
		return Object.freeze({
			id: this.id,
			calls: this.calls,
			channelEdges: CHANNEL_EDGES.length,
			gates: 64,
			last: this.last
				? Object.freeze({
					bodySun: this.last.bodySun,
					awareness: Object.freeze({
						spleen: this.last.spleen,
						ajna: this.last.ajna,
						solarPlexus: this.last.solarPlexus,
						heart: this.last.heart,
						mind: this.last.mind,
					}),
				})
				: null,
			metadata: this.metadata,
		});
	}
}

export { TRAINING_METADATA };
export default new HumanDesignGNNRuntime();

// Browser-native port of Flask/automata_engine.py.
// The donor's five perspective labels remain intact; projectionBindings are an
// explicit integration adapter into Synthia's Knowledge/Causal/Phase/Temporal/
// Dependency mesh rather than a rewrite of donor semantics.

export const DONOR_DIMENSIONS = Object.freeze([
	"AXIAL",
	"RELATIONAL",
	"TEMPORAL",
	"COGNITIVE",
	"SENSORY",
]);

export const FORMS = Object.freeze([
	"AXON",
	"AXIS",
	"ARC-SECOND",
	"BIGRAM",
	"TRIGRAM",
	"HEXAGRAM",
	"DECAGRAM",
]);

export const PROJECTION_BINDINGS = Object.freeze({
	COGNITIVE: "knowledge",
	RELATIONAL: "causal",
	SENSORY: "phase",
	TEMPORAL: "temporal",
	AXIAL: "dependency",
});

export const CONNECTION_FIELD_SCHEMA = Object.freeze({
	nodes: 64,
	connectionsPerNode: 36,
	filtersPerNode: 13,
	behavioralStates: 6,
	motivationsPerState: 6,
	sensesPerMotivation: 6,
	bases: 5,
	outcomes: 12,
	maxAngleDegrees: 29.625,
	dimensionsAreProjections: true,
});

function clamp(value, low = 0, high = 1) {
	return Math.max(low, Math.min(high, Number(value) || 0));
}

function seeded(seed) {
	let value = (Math.abs(Math.trunc(Number(seed) || 42)) ^ 0x9e3779b9) >>> 0;
	return () => {
		value += 0x6d2b79f5;
		let result = value;
		result = Math.imul(result ^ (result >>> 15), result | 1);
		result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
		return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
	};
}

function activation(value, type) {
	if (type === "relu") return Math.max(0, value);
	if (type === "linear") return value;
	if (type === "step") return value >= 0 ? 1 : 0;
	if (type === "tanh") return Math.tanh(value);
	const clipped = Math.max(-60, Math.min(60, value));
	return 1 / (1 + Math.exp(-clipped));
}

function resolveForm(
	state,
	position,
	direction,
	dimensionIndex,
	perspective,
	scale,
	neighborSignal,
) {
	const trajectory = direction * (position + perspective) * (dimensionIndex + 1);
	let signal = state * 0.41 + trajectory * 0.23 + scale * 0.19;
	signal += neighborSignal * 0.37;
	return FORMS[Math.trunc(Math.abs(signal) * 1000) % FORMS.length];
}

function nodeAddress(
	index,
	stateIndex,
	motivationIndex,
	senseIndex,
	baseIndex,
	outcomeIndex,
) {
	return Object.freeze({
		node: `N${String(index).padStart(2, "0")}`,
		state: `S${stateIndex}`,
		motivation: `M${motivationIndex}`,
		sense: `X${senseIndex}`,
		base: `B${baseIndex}`,
		outcome: `O${outcomeIndex}`,
		path: `N${String(index).padStart(2, "0")}/S${stateIndex}/M${motivationIndex}/X${senseIndex}/B${baseIndex}/O${outcomeIndex}`,
	});
}

function dimensionResolution(index, node, dimensionIndex) {
	const dimension = DONOR_DIMENSIONS[dimensionIndex];
	const perspective = ((index * 17 + dimensionIndex * 23) % 101) / 100;
	const scale = 1 + ((index + dimensionIndex * 3) % 7);
	const position =
		((index * (dimensionIndex + 3)) % CONNECTION_FIELD_SCHEMA.nodes) /
		(CONNECTION_FIELD_SCHEMA.nodes - 1);
	const angle =
		(((index * 7 + dimensionIndex * 11) % 1000) / 1000) *
		CONNECTION_FIELD_SCHEMA.maxAngleDegrees;
	return Object.freeze({
		dimension,
		dimensionIndex,
		meshProjection: PROJECTION_BINDINGS[dimension],
		form: resolveForm(
			node.stateValue,
			position,
			node.direction,
			dimensionIndex,
			perspective,
			scale / 7,
			node.activation,
		),
		position,
		direction: node.direction,
		perspective,
		scale,
		angleDegrees: angle,
	});
}

function refreshResolutions(nodes) {
	for (const node of nodes) {
		node.resolutions = DONOR_DIMENSIONS.map((_, dimensionIndex) =>
			dimensionResolution(node.index, node, dimensionIndex),
		);
		node.forms = node.resolutions.map((resolution) => resolution.form);
		node.activeFilters = node.filters.filter((filter) => filter.active).length;
	}
}

function sampleWithoutReplacement(count, excludedIndex, rng) {
	const candidates = [];
	for (let index = 0; index < CONNECTION_FIELD_SCHEMA.nodes; index += 1) {
		if (index !== excludedIndex) candidates.push(index);
	}
	for (let index = candidates.length - 1; index > 0; index -= 1) {
		const pick = Math.floor(rng() * (index + 1));
		[candidates[index], candidates[pick]] = [candidates[pick], candidates[index]];
	}
	return candidates.slice(0, count);
}

export function buildConnectionField({
	description = "",
	seed = 42,
	connectionsPerNode = CONNECTION_FIELD_SCHEMA.connectionsPerNode,
} = {}) {
	const count = Math.max(
		1,
		Math.min(CONNECTION_FIELD_SCHEMA.nodes - 1, Math.trunc(connectionsPerNode)),
	);
	const rng = seeded(seed);
	const activationTypes = ["sigmoid", "tanh", "relu", "linear", "step"];
	const nodes = [];

	for (let index = 0; index < CONNECTION_FIELD_SCHEMA.nodes; index += 1) {
		const stateIndex = Math.floor(rng() * 6);
		const motivationIndex = Math.floor(rng() * 6);
		const senseIndex = Math.floor(rng() * 6);
		const baseIndex = Math.floor(rng() * 5);
		const outcomeIndex = Math.floor(rng() * 12);
		const node = {
			id: `N${String(index).padStart(2, "0")}`,
			index,
			activation: 0.05 + rng() * 0.9,
			bias: -0.25 + rng() * 0.5,
			stateValue: rng(),
			direction: rng() >= 0.5 ? 1 : -1,
			activationType: activationTypes[index % activationTypes.length],
			address: nodeAddress(
				index,
				stateIndex,
				motivationIndex,
				senseIndex,
				baseIndex,
				outcomeIndex,
			),
			behavior: Object.freeze({
				stateIndex,
				motivationIndex,
				senseIndex,
			}),
			filters: [],
			connections: [],
			resolutions: [],
			forms: [],
			activeFilters: 0,
		};
		for (let filterIndex = 0; filterIndex < 13; filterIndex += 1) {
			const threshold = ((index * 5 + filterIndex * 7) % 100) / 100;
			node.filters.push({
				id: `F${String(filterIndex + 1).padStart(2, "0")}`,
				threshold,
				weight: -1 + rng() * 2,
				active: node.activation >= threshold,
			});
		}
		nodes.push(node);
	}

	for (let sourceIndex = 0; sourceIndex < nodes.length; sourceIndex += 1) {
		const connectionRng = seeded(Number(seed) * 1009 + sourceIndex);
		for (const targetIndex of sampleWithoutReplacement(
			count,
			sourceIndex,
			connectionRng,
		)) {
			nodes[sourceIndex].connections.push({
				target: `N${String(targetIndex).padStart(2, "0")}`,
				weight: -1 + connectionRng() * 2,
				enabled: true,
			});
		}
	}

	refreshResolutions(nodes);
	return {
		modelType: "perspective-conditioned-automata-mesh",
		description: String(description).trim() || "Synthia shared connection field",
		seed: Number(seed) || 42,
		step: 0,
		nodes,
		dimensions: [...DONOR_DIMENSIONS],
		projectionBindings: { ...PROJECTION_BINDINGS },
		schema: {
			...CONNECTION_FIELD_SCHEMA,
			connectionsPerNode: count,
			forms: [...FORMS],
		},
		training: {
			trainable: true,
			algorithm: "local-delta weighted propagation",
			loss: null,
			lossHistory: [],
			epochs: 0,
			learningRate: null,
		},
	};
}

export function advanceConnectionField(model) {
	const nodes = model.nodes;
	const incoming = new Map(nodes.map((node) => [node.id, 0]));

	for (const source of nodes) {
		for (const connection of source.connections) {
			if (!connection.enabled || !incoming.has(connection.target)) continue;
			incoming.set(
				connection.target,
				incoming.get(connection.target) +
					source.activation * connection.weight,
			);
		}
	}

	for (const node of nodes) {
		let raw = incoming.get(node.id) / Math.max(1, node.connections.length);
		raw += node.bias;
		node.activation = clamp(activation(raw, node.activationType));
		node.stateValue = clamp(node.stateValue * 0.65 + node.activation * 0.35);
		for (const filter of node.filters) {
			filter.active = node.activation >= filter.threshold;
		}
	}

	model.step += 1;
	refreshResolutions(nodes);
	return model;
}

function normalizeVector(values, length = 64, fallback = 0.5) {
	const output = new Array(length).fill(fallback);
	for (let index = 0; index < Math.min(length, values?.length || 0); index += 1) {
		output[index] = clamp(values[index]);
	}
	return output;
}

export function trainConnectionField(
	model,
	examples,
	{ epochs = 5, learningRate = 0.05 } = {},
) {
	const safeEpochs = Math.max(1, Math.min(1000, Math.trunc(epochs)));
	const rate = Math.max(0.00001, Math.min(2, Number(learningRate) || 0.05));
	const trainingExamples =
		Array.isArray(examples) && examples.length
			? examples
			: [{
				inputs: model.nodes.map((node) => node.activation),
				targets: new Array(64).fill(0.5),
			}];
	const incoming = new Map(model.nodes.map((node) => [node.id, []]));

	for (const source of model.nodes) {
		for (const connection of source.connections) {
			if (connection.enabled && incoming.has(connection.target)) {
				incoming.get(connection.target).push({ source, connection });
			}
		}
	}

	const losses = [];
	for (let epoch = 0; epoch < safeEpochs; epoch += 1) {
		let epochLoss = 0;
		for (const example of trainingExamples) {
			const inputs = normalizeVector(example.inputs, 64, 0);
			const targets = normalizeVector(example.targets, 64, 0.5);
			model.nodes.forEach((node, index) => {
				node.activation = inputs[index];
			});
			advanceConnectionField(model);

			const deltas = new Map();
			model.nodes.forEach((node, index) => {
				const error = targets[index] - node.activation;
				epochLoss += error * error;
				deltas.set(node.id, error);
			});

			for (const node of model.nodes) {
				const delta = deltas.get(node.id);
				node.bias += rate * delta;
				for (const { source, connection } of incoming.get(node.id)) {
					connection.weight += rate * delta * source.activation;
					connection.weight = Math.max(-2, Math.min(2, connection.weight));
				}
			}
		}
		losses.push(epochLoss / (trainingExamples.length * model.nodes.length));
	}

	model.training = {
		trainable: true,
		algorithm: "local-delta weighted propagation",
		loss: losses.at(-1),
		lossHistory: losses,
		epochs: safeEpochs,
		learningRate: rate,
		examples: trainingExamples.length,
	};
	refreshResolutions(model.nodes);
	return model.training;
}

export class ConnectionFieldRuntime {
	constructor({ seed = 42 } = {}) {
		this.id = "perspective-connection-field";
		this.address = Object.freeze({ gate: 36, line: 1, color: 1, tone: 1, base: 1 });
		this.metadata = Object.freeze({
			capabilities: Object.freeze([
				"neural.connection.observe",
				"neural.connection.propagate",
				"neural.connection.train",
				"neural.connection.perspective",
			]),
			lineage: "Flask/automata_engine.py",
			projectionBindings: PROJECTION_BINDINGS,
		});
		this.model = buildConnectionField({ seed });
	}

	activateGate(gate, strength = 1) {
		const index = Math.min(63, Math.max(0, Math.trunc(Number(gate) || 1) - 1));
		this.model.nodes[index].activation = clamp(strength);
		this.model.nodes[index].stateValue = clamp(
			this.model.nodes[index].stateValue * 0.5 + clamp(strength) * 0.5,
		);
		refreshResolutions(this.model.nodes);
		return this.model.nodes[index];
	}

	observeCue({ address = {}, signal = 1 } = {}) {
		const gate = Math.min(64, Math.max(1, Math.trunc(Number(address.gate) || 1)));
		this.activateGate(gate, signal);
		advanceConnectionField(this.model);
		const top = this.model.nodes
			.slice()
			.sort((left, right) => right.activation - left.activation)
			.slice(0, 8)
			.map((node) => ({
				id: node.id,
				gate: node.index + 1,
				activation: node.activation,
				forms: [...node.forms],
			}));
		return Object.freeze({
			gate,
			step: this.model.step,
			top: Object.freeze(top),
			projections: Object.freeze(
				Object.fromEntries(
					DONOR_DIMENSIONS.map((dimension) => [
						PROJECTION_BINDINGS[dimension],
						Object.freeze({
							donorDimension: dimension,
							form: this.model.nodes[gate - 1].resolutions[
								DONOR_DIMENSIONS.indexOf(dimension)
							].form,
						}),
					]),
				),
			),
		});
	}

	async call(input = {}) {
		const operation = input.operation || input.op || "observe";
		if (operation === "observe") return this.observeCue(input);
		if (operation === "advance") {
			advanceConnectionField(this.model);
			return this.snapshot();
		}
		if (operation === "train") {
			return trainConnectionField(this.model, input.examples, {
				epochs: input.epochs,
				learningRate: input.learningRate,
			});
		}
		if (operation === "perspective") {
			const dimension = String(input.dimension || "COGNITIVE").toUpperCase();
			if (!DONOR_DIMENSIONS.includes(dimension)) {
				throw new Error(`Unknown connection-field perspective: ${dimension}`);
			}
			return Object.freeze({
				dimension,
				meshProjection: PROJECTION_BINDINGS[dimension],
				nodes: Object.freeze(
					this.model.nodes.map((node) =>
						node.resolutions[DONOR_DIMENSIONS.indexOf(dimension)],
					),
				),
			});
		}
		throw new Error(`Unsupported ConnectionField operation: ${operation}`);
	}

	snapshot() {
		return Object.freeze({
			id: this.id,
			modelType: this.model.modelType,
			step: this.model.step,
			schema: Object.freeze({ ...this.model.schema }),
			dimensions: Object.freeze([...this.model.dimensions]),
			projectionBindings: Object.freeze({ ...this.model.projectionBindings }),
			training: Object.freeze({
				...this.model.training,
				lossHistory: Object.freeze([...(this.model.training.lossHistory || [])]),
			}),
			topActivations: Object.freeze(
				this.model.nodes
					.slice()
					.sort((left, right) => right.activation - left.activation)
					.slice(0, 8)
					.map((node) =>
						Object.freeze({
							gate: node.index + 1,
							activation: node.activation,
							forms: Object.freeze([...node.forms]),
						}),
					),
			),
		});
	}
}

export default new ConnectionFieldRuntime();

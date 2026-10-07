
function sigmoid(value) {
	if (value >= 0) {
		const z = Math.exp(-value);
		return 1 / (1 + z);
	}
	const z = Math.exp(value);
	return z / (1 + z);
}

function clamp01(value) {
	return Math.max(0, Math.min(1, Number(value) || 0));
}

function seeded(seed) {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

const FEATURE_KEYS = Object.freeze([
	"ruleCount",
	"support",
	"affinity",
	"complexity",
	"workerFit",
	"novelty",
	"uncertainty",
	"priorSuccess",
]);

export class CompositionPredictor {
	constructor({ hidden = 6, seed = 1337 } = {}) {
		if (!Number.isInteger(hidden) || hidden < 2) {
			throw new RangeError("hidden must be an integer >= 2.");
		}
		this.hidden = hidden;
		const random = seeded(seed);
		const weight = () => (random() * 2 - 1) * 0.25;
		this.w1 = Array.from({ length: hidden }, () => (
			Array.from({ length: FEATURE_KEYS.length }, weight)
		));
		this.b1 = new Array(hidden).fill(0);
		this.wQuality = Array.from({ length: hidden }, weight);
		this.bQuality = 0;
		this.wCost = Array.from({ length: hidden }, weight);
		this.bCost = 0;
		this.samples = 0;
		this.errorEma = 0.5;
	}

	features(candidate = {}) {
		const values = candidate.features || candidate;
		const vector = [
			Math.min(1, Math.max(0, (values.ruleCount || 0) / 8)),
			clamp01(values.support),
			clamp01(values.affinity),
			clamp01(values.complexity),
			clamp01(values.workerFit),
			clamp01(values.novelty),
			clamp01(values.uncertainty),
			clamp01(values.priorSuccess),
		];
		return Object.freeze(vector);
	}

	#forward(vector) {
		const hidden = this.w1.map((row, index) => {
			let sum = this.b1[index];
			for (let feature = 0; feature < vector.length; feature += 1) {
				sum += row[feature] * vector[feature];
			}
			return Math.tanh(sum);
		});
		const qualityLogit = hidden.reduce(
			(sum, value, index) => sum + value * this.wQuality[index],
			this.bQuality,
		);
		const costLogit = hidden.reduce(
			(sum, value, index) => sum + value * this.wCost[index],
			this.bCost,
		);
		return {
			hidden,
			quality: sigmoid(qualityLogit),
			cost: sigmoid(costLogit),
		};
	}

	predict(candidate) {
		const vector = this.features(candidate);
		const result = this.#forward(vector);
		return Object.freeze({
			quality: result.quality,
			cost: result.cost,
			utility: clamp01(result.quality * (1 - 0.55 * result.cost)),
			confidence: clamp01(
				0.25 + Math.min(0.65, this.samples / 80) + (1 - this.errorEma) * 0.1,
			),
			features: vector,
		});
	}

	learn(candidate, {
		quality,
		cost,
	} = {}, {
		learningRate = 0.08,
	} = {}) {
		const targetQuality = clamp01(quality);
		const targetCost = clamp01(cost);
		const vector = this.features(candidate);
		const forward = this.#forward(vector);
		const qualityError = forward.quality - targetQuality;
		const costError = forward.cost - targetCost;
		const qualityDelta = qualityError * forward.quality * (1 - forward.quality);
		const costDelta = costError * forward.cost * (1 - forward.cost);

		const hiddenGrad = new Array(this.hidden).fill(0);
		for (let index = 0; index < this.hidden; index += 1) {
			hiddenGrad[index] =
				qualityDelta * this.wQuality[index] +
				costDelta * this.wCost[index];
			this.wQuality[index] -= learningRate * qualityDelta * forward.hidden[index];
			this.wCost[index] -= learningRate * costDelta * forward.hidden[index];
		}
		this.bQuality -= learningRate * qualityDelta;
		this.bCost -= learningRate * costDelta;

		for (let hidden = 0; hidden < this.hidden; hidden += 1) {
			const tanhGrad = 1 - forward.hidden[hidden] ** 2;
			const delta = hiddenGrad[hidden] * tanhGrad;
			for (let feature = 0; feature < vector.length; feature += 1) {
				this.w1[hidden][feature] -= learningRate * delta * vector[feature];
			}
			this.b1[hidden] -= learningRate * delta;
		}

		this.samples += 1;
		const absError = (Math.abs(qualityError) + Math.abs(costError)) / 2;
		this.errorEma = this.samples === 1
			? absError
			: 0.9 * this.errorEma + 0.1 * absError;
		return this.predict(candidate);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.composition-predictor.v1",
			hidden: this.hidden,
			samples: this.samples,
			errorEma: this.errorEma,
			featureKeys: FEATURE_KEYS,
			w1: structuredClone(this.w1),
			b1: [...this.b1],
			wQuality: [...this.wQuality],
			bQuality: this.bQuality,
			wCost: [...this.wCost],
			bCost: this.bCost,
		});
	}

	restore(snapshot) {
		if (snapshot?.version !== "synthia.composition-predictor.v1") {
			throw new TypeError("Unsupported composition predictor snapshot.");
		}
		this.hidden = snapshot.hidden;
		this.samples = snapshot.samples;
		this.errorEma = snapshot.errorEma;
		this.w1 = structuredClone(snapshot.w1);
		this.b1 = [...snapshot.b1];
		this.wQuality = [...snapshot.wQuality];
		this.bQuality = snapshot.bQuality;
		this.wCost = [...snapshot.wCost];
		this.bCost = snapshot.bCost;
		return this;
	}
}

export { FEATURE_KEYS };


function clamp01(value) {
	return Math.max(0, Math.min(1, Number(value) || 0));
}

export const EXPLORATION_STRATEGIES = Object.freeze([
	"exploit",
	"uncertainty-directed",
	"novelty",
	"value-free",
]);

export class ExplorationController {
	constructor({ valueFreePeriod = 13 } = {}) {
		this.valueFreePeriod = valueFreePeriod;
		this.step = 0;
	}

	select({
		confidence = 0.5,
		uncertainty = 0.5,
		novelty = 0,
		horizon = 1,
	} = {}) {
		this.step += 1;
		const c = clamp01(confidence);
		const u = clamp01(uncertainty);
		const n = clamp01(novelty);
		let strategy = "exploit";
		if (horizon > 1 && u > Math.max(0.45, c)) {
			strategy = "uncertainty-directed";
		} else if (n > 0.55) {
			strategy = "novelty";
		} else if (horizon >= 4 && this.step % this.valueFreePeriod === 0) {
			strategy = "value-free";
		}
		return Object.freeze({
			strategy,
			confidence: c,
			uncertainty: u,
			novelty: n,
			horizon,
			step: this.step,
		});
	}

	adjust(prediction, candidate, decision) {
		const base = Number(prediction?.utility || 0);
		const novelty = clamp01(candidate?.features?.novelty);
		const uncertainty = clamp01(candidate?.features?.uncertainty);
		switch (decision?.strategy) {
			case "uncertainty-directed":
				return clamp01(base + uncertainty * 0.18);
			case "novelty":
				return clamp01(base + novelty * 0.16);
			case "value-free":
				return 0.5;
			default:
				return clamp01(base);
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.exploration-controller.v1",
			step: this.step,
			valueFreePeriod: this.valueFreePeriod,
		});
	}
}

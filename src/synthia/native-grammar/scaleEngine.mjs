
import { DEFAULT_SCALE_LADDER, SCALE_OPERATIONS } from "./constants.mjs";

function normalizeIndex(scale, ladder) {
	if (Number.isInteger(Number(scale))) {
		return Math.max(0, Math.min(ladder.length - 1, Number(scale)));
	}
	const index = ladder.indexOf(String(scale));
	return index >= 0 ? index : 0;
}

function freeze(value) {
	return Object.freeze(value);
}

export class ScaleEngine {
	constructor({ ladder = DEFAULT_SCALE_LADDER } = {}) {
		this.ladder = Object.freeze([...ladder]);
	}

	operate(operation, state, context = {}) {
		const op = String(operation || "").toUpperCase();
		if (!SCALE_OPERATIONS.includes(op)) {
			throw new RangeError(`Unknown scale operation: ${operation}`);
		}
		const current = normalizeIndex(state?.scale ?? context.scale ?? 0, this.ladder);

		switch (op) {
			case "UP":
				return freeze({
					operation: op,
					scale: Math.min(current + 1, this.ladder.length - 1),
					scaleName: this.ladder[Math.min(current + 1, this.ladder.length - 1)],
					value: state,
				});
			case "DOWN":
				return freeze({
					operation: op,
					scale: Math.max(current - 1, 0),
					scaleName: this.ladder[Math.max(current - 1, 0)],
					value: state,
				});
			case "FOLD":
				return freeze({
					operation: op,
					scale: Math.min(current + 1, this.ladder.length - 1),
					scaleName: this.ladder[Math.min(current + 1, this.ladder.length - 1)],
					value: freeze({
						kind: "folded-unit",
						members: Object.freeze([...(context.members || [state])]),
					}),
				});
			case "UNFOLD":
				return freeze({
					operation: op,
					scale: Math.max(current - 1, 0),
					scaleName: this.ladder[Math.max(current - 1, 0)],
					value: Object.freeze([...(context.components || state?.components || [])]),
					status:
						(context.components || state?.components)
							? "resolved"
							: "unresolved",
				});
			case "CROSS":
				return freeze({
					operation: op,
					scale: current,
					scaleName: this.ladder[current],
					value: context.counterpart ?? null,
					status: context.counterpart == null ? "unresolved" : "resolved",
				});
			case "PIVOT":
				return freeze({
					operation: op,
					scale: current,
					scaleName: this.ladder[current],
					axis: context.axis ?? null,
					branches: Object.freeze([...(context.branches || [])]),
					status:
						context.axis == null && !(context.branches || []).length
							? "unresolved"
							: "resolved",
				});
			default:
				throw new RangeError(`Unsupported scale operation: ${op}`);
		}
	}

	inspect(state, context = {}) {
		const current = normalizeIndex(context.scale ?? state?.scale ?? 0, this.ladder);
		return freeze({
			current: freeze({
				scale: current,
				name: this.ladder[current],
				value: state,
			}),
			up: this.operate("UP", { ...state, scale: current }, context),
			down: this.operate("DOWN", { ...state, scale: current }, context),
			cross: this.operate("CROSS", { ...state, scale: current }, context),
			pivot: this.operate("PIVOT", { ...state, scale: current }, context),
		});
	}
}

export default new ScaleEngine();

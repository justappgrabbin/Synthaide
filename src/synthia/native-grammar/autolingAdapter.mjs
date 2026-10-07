
/**
 * AutoLing boundary for outside-language analysis.
 *
 * The native grammar does not depend on AutoLing being available. When a Living Mesh
 * invoker is attached, outside language can be analyzed by the existing `autoling`
 * node before entering the canonical grammar.
 */
export class AutoLingAdapter {
	constructor({ invoke = null } = {}) {
		this.invoke = invoke;
	}

	setInvoker(invoke) {
		this.invoke = invoke;
		return this;
	}

	async analyze(text) {
		if (typeof this.invoke !== "function") {
			return Object.freeze({
				status: "unavailable",
				analysis: null,
			});
		}
		const output = await this.invoke("autoling", {
			operation: "pipeline",
			text: String(text || ""),
		});
		return Object.freeze({
			status: "resolved",
			analysis: output,
		});
	}
}

export default new AutoLingAdapter();

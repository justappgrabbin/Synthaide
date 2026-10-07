import "./morph-engine.js";

/**
 * Browser-facing bridge for the standalone Morph Engine supplied with Synthia.
 *
 * The engine stays an independent global library so it can still run by
 * itself. This bridge only gives the Acode shell a stable module boundary.
 */
export class MorphVisualRuntime {
	constructor() {
		this.engine = null;
		this.idle = null;
		this.reach = null;
		this.last = null;
	}

	get library() {
		return globalThis.MorphEngineLib || null;
	}

	get available() {
		return Boolean(this.library && typeof document !== "undefined");
	}

	initialize() {
		if (!this.available) {
			throw new Error("Morph visual engine requires a browser canvas.");
		}
		if (this.engine) return this;
		const lib = this.library;
		this.engine = new lib.MorphEngine();
		this.idle = this.engine.registerState(
			lib.renderCharacter(lib.poseIdle(), "idle"),
		);
		this.reach = this.engine.registerState(
			lib.renderCharacter(lib.poseReach(), "reach"),
		);
		return this;
	}

	run({ frames = 8, learn = true, easing = "smoothstep" } = {}) {
		this.initialize();
		this.last = this.engine.morph(this.idle, this.reach, {
			frames,
			learn,
			easing,
		});
		return this.last;
	}

	snapshot() {
		return Object.freeze({
			available: this.available,
			initialized: Boolean(this.engine),
			last: this.last
				? Object.freeze({
					frames: this.last.frames.length,
					qualityScore: this.last.report.score,
					observations: this.last.edge.observations,
					easing: this.last.edge.easing,
				})
				: null,
		});
	}
}

export default new MorphVisualRuntime();

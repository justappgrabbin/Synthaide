
import synthia from "./synthiaRuntime.mjs";

/**
 * Compatibility facade.
 *
 * The previous deterministic front-door pipeline has been removed.
 * Existing callers can keep importing atoEngine while execution delegates to
 * the canonical Synthia runtime.
 */
export class ATOEngine extends EventTarget {
	constructor({ runtime = synthia } = {}) {
		super();
		this.runtime = runtime;
		this.automata = Object.freeze([runtime.automaton.manifest()]);
		this.queue = [];
		this.activity = runtime.activity;
	}

	async process(input, options = {}) {
		return this.runtime.process(input, options);
	}

	request() {
		return {
			allowed: false,
			reason: "Permission requests are handled by the autonomy runtime.",
		};
	}
}

export default new ATOEngine();

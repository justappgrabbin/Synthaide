const DEFAULTS = Object.freeze({
	enabled: true,
	allowFileReads: true,
	allowFileWrites: false,
	allowExecution: false,
	allowNetwork: false,
	requireApprovalForWrites: true,
	maxActionsPerPulse: 5,
	pulseIntervalMs: 5000,
});

const memoryStorage = (() => {
	const values = new Map();
	return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
})();

export class AutonomyController extends EventTarget {
	constructor(storage = globalThis.localStorage || memoryStorage) {
		super();
		this.storage = storage;
		this.state = this.#load();
		this.audit = [];
	}

	#load() {
		try {
			return { ...DEFAULTS, ...JSON.parse(this.storage.getItem("synthia.autonomy") || "{}") };
		} catch {
			return { ...DEFAULTS };
		}
	}

	update(change) {
		this.state = { ...this.state, ...change };
		this.storage.setItem("synthia.autonomy", JSON.stringify(this.state));
		this.log("settings", change);
		this.dispatchEvent(new CustomEvent("change", { detail: this.state }));
		return this.state;
	}

	can(capability) {
		if (!this.state.enabled) return false;
		return Boolean(this.state[capability]);
	}

	log(action, detail = {}) {
		const record = { action, detail, at: new Date().toISOString() };
		this.audit.unshift(record);
		this.audit.length = Math.min(this.audit.length, 100);
		return record;
	}

	pause() {
		return this.update({ enabled: false });
	}
}

export { DEFAULTS as AUTONOMY_DEFAULTS };
export default new AutonomyController();

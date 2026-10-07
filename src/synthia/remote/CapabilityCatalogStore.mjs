const STORAGE_KEY = "synthia.remote-capability-catalog.v1";

function clone(value) {
	return typeof structuredClone === "function"
		? structuredClone(value)
		: JSON.parse(JSON.stringify(value));
}

export class MemoryCapabilityCatalogStore {
	constructor(seed = []) {
		this.value = clone(seed);
	}

	load() {
		return clone(this.value);
	}

	save(entries) {
		this.value = clone(entries);
		return this.load();
	}
}

export class LocalCapabilityCatalogStore {
	constructor({ storage = globalThis.localStorage, key = STORAGE_KEY } = {}) {
		if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
			throw new TypeError("A Web Storage-compatible catalog store is required");
		}
		this.storage = storage;
		this.key = key;
	}

	load() {
		const encoded = this.storage.getItem(this.key);
		if (!encoded) return [];
		const parsed = JSON.parse(encoded);
		if (!Array.isArray(parsed)) throw new TypeError("Stored capability catalog is not an array");
		return parsed;
	}

	save(entries) {
		this.storage.setItem(this.key, JSON.stringify(entries));
		return entries;
	}
}

export function defaultCapabilityCatalogStore() {
	return typeof globalThis.localStorage !== "undefined"
		? new LocalCapabilityCatalogStore()
		: new MemoryCapabilityCatalogStore();
}

export { STORAGE_KEY };

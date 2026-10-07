import { canonicalAddress, normalizeAddress } from "../ato-core/address-space.mjs";
import { defaultCapabilityCatalogStore } from "./CapabilityCatalogStore.mjs";

function normalizedEntry(input) {
	if (!input?.id) throw new TypeError("A remote capability requires an id");
	if (!input?.address) throw new TypeError(`Remote capability ${input.id} requires an address`);
	if (!/^https?:\/\//i.test(String(input.url || ""))) {
		throw new TypeError(`Remote capability ${input.id} requires an HTTPS/HTTP artifact URL`);
	}
	if (!/^[a-f0-9]{64}$/i.test(String(input.sha256 || ""))) {
		throw new TypeError(`Remote capability ${input.id} requires a complete SHA-256 digest`);
	}
	const address = normalizeAddress(input.address, {
		mode: input.address.mode || "macro",
		allowUnresolved: false,
	});
	return Object.freeze({
		id: String(input.id),
		address,
		addressKey: canonicalAddress(address),
		url: String(input.url),
		sha256: String(input.sha256).toLowerCase(),
		format: input.format || "esm",
		filename: input.filename || `${input.id}.mjs`,
		capabilities: Object.freeze([...new Set((input.capabilities || []).map(String))].sort()),
		transition: Object.freeze({
			accepts: Object.freeze([...(input.transition?.accepts || [])].map(String)),
			produces: Object.freeze([...(input.transition?.produces || [])].map(String)),
		}),
		contracts: Object.freeze({ ...(input.contracts || {}) }),
		provenance: Object.freeze({ ...(input.provenance || {}) }),
		metadata: Object.freeze({ ...(input.metadata || {}) }),
	});
}

export class CapabilityCatalog {
	constructor({ store = defaultCapabilityCatalogStore() } = {}) {
		this.store = store;
		this.entries = new Map();
		this.byAddress = new Map();
		this.byCapability = new Map();
		this.byOutput = new Map();
	}

	register(input, { persist = true } = {}) {
		const entry = normalizedEntry(input);
		if (this.entries.has(entry.id)) throw new Error(`Duplicate remote capability: ${entry.id}`);
		this.entries.set(entry.id, entry);
		this.#index(this.byAddress, entry.addressKey, entry.id);
		for (const capability of entry.capabilities) this.#index(this.byCapability, capability, entry.id);
		for (const output of entry.transition.produces) this.#index(this.byOutput, output, entry.id);
		if (persist) this.persist();
		return entry;
	}

	hydrate() {
		const stored = this.store.load();
		for (const input of stored) {
			if (!this.entries.has(String(input.id))) this.register(input, { persist: false });
		}
		return this.snapshot();
	}

	persist() {
		return this.store.save([...this.entries.values()]);
	}

	get(id) {
		return this.entries.get(String(id)) || null;
	}

	resolve({ id = null, address = null, capability = null, produces = null } = {}) {
		if (id) return Object.freeze(this.get(id) ? [this.get(id)] : []);
		const ids = address
			? this.byAddress.get(canonicalAddress(address))
			: capability
				? this.byCapability.get(String(capability))
				: produces
					? this.byOutput.get(String(produces))
					: new Set();
		return Object.freeze([...(ids || [])].map((entryId) => this.entries.get(entryId)));
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.capability-catalog.v1",
			count: this.entries.size,
			entries: Object.freeze([...this.entries.values()].sort((a, b) => a.id.localeCompare(b.id))),
		});
	}

	#index(index, key, id) {
		if (!index.has(key)) index.set(key, new Set());
		index.get(key).add(id);
	}
}

export default CapabilityCatalog;

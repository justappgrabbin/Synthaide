function outputAtoms(descriptor) {
	return descriptor?.produces?.status === "checked"
		? descriptor.produces.value || []
		: [];
}

function addressKey(address) {
	const entries = Object.entries(address || {})
		.filter(([, value]) => value !== undefined && value !== null)
		.sort(([a], [b]) => a.localeCompare(b));
	return entries.map(([key, value]) => `${key}=${String(value)}`).join("|");
}

export class TransitionIndex {
	constructor() {
		this.byComponent = new Map();
		this.byOutput = new Map();
		this.byTrigger = new Map();
		this.byAddress = new Map();
	}

	register(descriptor) {
		if (!descriptor?.componentId || !descriptor?.address) {
			throw new TypeError("TransitionIndex.register requires a transition descriptor.");
		}

		this.remove(descriptor.componentId);
		this.byComponent.set(descriptor.componentId, descriptor);
		this.byAddress.set(addressKey(descriptor.address), descriptor);

		for (const atom of outputAtoms(descriptor)) {
			const bucket = this.byOutput.get(atom) || new Set();
			bucket.add(descriptor.componentId);
			this.byOutput.set(atom, bucket);
		}

		for (const trigger of descriptor.triggers || []) {
			const bucket = this.byTrigger.get(trigger) || new Set();
			bucket.add(descriptor.componentId);
			this.byTrigger.set(trigger, bucket);
		}

		return descriptor;
	}

	remove(componentId) {
		const id = String(componentId);
		const existing = this.byComponent.get(id);
		if (!existing) return false;

		this.byComponent.delete(id);
		this.byAddress.delete(addressKey(existing.address));

		for (const bucket of this.byOutput.values()) bucket.delete(id);
		for (const bucket of this.byTrigger.values()) bucket.delete(id);
		return true;
	}

	get(componentId) {
		return this.byComponent.get(String(componentId)) || null;
	}

	findByAddress(address) {
		return this.byAddress.get(addressKey(address)) || null;
	}

	findByOutput(required = []) {
		const atoms = Array.isArray(required) ? required : [required];
		const ids = new Set();
		for (const atom of atoms) {
			for (const id of this.byOutput.get(String(atom)) || []) ids.add(id);
		}
		return Object.freeze(
			[...ids]
				.map((id) => this.byComponent.get(id))
				.filter(Boolean),
		);
	}

	findByTrigger(trigger) {
		return Object.freeze(
			[...(this.byTrigger.get(String(trigger)) || [])]
				.map((id) => this.byComponent.get(id))
				.filter(Boolean),
		);
	}

	list({ resolved = null } = {}) {
		return Object.freeze(
			[...this.byComponent.values()]
				.filter((descriptor) =>
					resolved === null
						? true
						: resolved
							? descriptor.status === "resolved"
							: descriptor.status !== "resolved",
				)
				.sort((a, b) => a.componentId.localeCompare(b.componentId)),
		);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.transition-index.v1",
			count: this.byComponent.size,
			resolved: this.list({ resolved: true }).length,
			unresolved: this.list({ resolved: false }).length,
			records: this.list().map((descriptor) => descriptor.toJSON()),
		});
	}
}

export { addressKey };
export default TransitionIndex;

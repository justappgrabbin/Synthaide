
function ensureMesh(mesh) {
	if (!mesh || !(mesh.automatons instanceof Map)) {
		throw new TypeError("Capability broker requires an AutomataMesh-compatible object.");
	}
	return mesh;
}

function capabilitiesOf(automaton) {
	return Array.isArray(automaton?.metadata?.capabilities)
		? automaton.metadata.capabilities
		: [];
}

export class CapabilityBroker {
	constructor({ meshes = [] } = {}) {
		this.meshes = new Set();
		for (const mesh of meshes) this.attach(mesh);
	}

	attach(mesh) {
		this.meshes.add(ensureMesh(mesh));
		return this;
	}

	detach(mesh) {
		this.meshes.delete(mesh);
		return this;
	}

	discover(capability = null) {
		const found = [];
		for (const mesh of this.meshes) {
			for (const automaton of mesh.automatons.values()) {
				const capabilities = capabilitiesOf(automaton);
				if (!capabilities.length) continue;
				if (capability && !capabilities.includes(capability)) continue;
				found.push(Object.freeze({
					id: automaton.id,
					capabilities: Object.freeze([...capabilities]),
					automaton,
					mesh,
				}));
			}
		}
		return Object.freeze(found.sort((a, b) => a.id.localeCompare(b.id)));
	}

	workers() {
		return Object.freeze(this.discover().map((item) => Object.freeze({
			id: item.id,
			capabilities: item.capabilities,
			status: "available",
		})));
	}

	async invoke(capability, input, { automatonId = null } = {}) {
		const targets = this.discover(capability);
		const target = automatonId
			? targets.find((item) => item.id === automatonId)
			: targets[0];
		if (!target) {
			return Object.freeze({
				status: "unavailable",
				capability,
				automatonId: automatonId || null,
				output: null,
			});
		}
		try {
			const output = await target.automaton.call(input);
			return Object.freeze({
				status: "complete",
				capability,
				automatonId: target.id,
				output,
			});
		} catch (error) {
			return Object.freeze({
				status: "failed",
				capability,
				automatonId: target.id,
				error: error.message,
				output: null,
			});
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.capability-broker.v1",
			meshCount: this.meshes.size,
			workers: this.workers(),
		});
	}
}

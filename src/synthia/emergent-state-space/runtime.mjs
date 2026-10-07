import canonicalState from "../canonicalState.mjs";
import { StateSpace as EmergentStateSpace } from "./core/state_space_core.mjs";
import { EmergentMesh } from "./mesh/emergent_mesh.mjs";
import gateTable from "./gate-table.mjs";

/**
 * Browser-native bridge around the original v0.6.7 state-space engine.
 *
 * The original 5 × 64 structural mesh is preserved. Text/address resolution
 * delegates to Synthia's current address resolver rather than introducing a
 * second text-address algorithm.
 */
export class StateSpace extends EmergentStateSpace {
	constructor({ authority = canonicalState, table = gateTable } = {}) {
		super(table);
		this.authority = authority;
	}

	get nodes() {
		return Object.entries(this.dimensions).flatMap(([dimension, layer]) => (
			layer.nodes.map((node) => Object.freeze({ ...node, dimension }))
		));
	}

	resolve(input, overrides = {}) {
		return this.authority.resolve(input, overrides);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.emergent-state-space.v0.6.7",
			nodeCount: this.nodes.length,
			dimensions: Object.freeze(Object.keys(this.dimensions)),
			content: Object.freeze(this.contentSummary()),
		});
	}
}

export class EmergentStateMesh {
	constructor({ table = gateTable } = {}) {
		this.mesh = new EmergentMesh(table);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.emergent-mesh.v0.6.7",
			...this.mesh.summary(),
		});
	}
}

export { EmergentMesh, gateTable };

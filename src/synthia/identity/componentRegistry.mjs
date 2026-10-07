
import canonicalState from "../canonicalState.mjs";
import { deriveTransitionDescriptor } from "../resolver/TransitionDescriptor.mjs";

const REQUIRED_SECTIONS = Object.freeze([
	"who",
	"what",
	"where",
	"why",
	"how",
	"relationships",
	"behaviors",
	"dependencies",
	"when",
	"provenance",
]);

function clone(value) {
	return value == null ? value : structuredClone(value);
}

function checked(value) {
	return Object.freeze({
		status: "checked",
		value: clone(value),
	});
}

function unresolved() {
	return Object.freeze({
		status: "unresolved",
		value: null,
	});
}

function normalizeSection(value, emptyValue) {
	if (value === undefined) return unresolved();
	if (value === null) return unresolved();
	return checked(value ?? emptyValue);
}

function normalizeAddress(address, seed) {
	const projected = canonicalState.resolve(seed);
	if (address && typeof address === "object") {
		return Object.freeze({
			...projected,
			...address,
			dimension:
				address.dimension ||
				address.planetaryDimension ||
				projected.dimension,
		});
	}
	return projected;
}

function defaultWho(input) {
	return Object.freeze({
		id: String(input.id),
		name: String(input.name || input.id),
		kind: String(input.kind || "component"),
		version: input.version == null ? null : String(input.version),
		lineage: input.lineage == null ? null : String(input.lineage),
	});
}

export class ComponentRegistry {
	constructor({ addressAuthority = canonicalState } = {}) {
		this.addressAuthority = addressAuthority;
		this.records = new Map();
		this.intake = [];
	}

	identify(input = {}) {
		const id = String(input.id || "").trim();
		if (!id) throw new TypeError("Component identity requires an id.");

		const addressSeed = [
			"component",
			id,
			input.kind || "component",
			input.purpose || input.why || "",
		].join(":");
		const address = normalizeAddress(input.address, addressSeed);

		const record = {
			id,
			address,
			who: normalizeSection(input.who ?? defaultWho(input), {}),
			what: normalizeSection(input.what, {}),
			where: normalizeSection(
				input.where ?? {
					address,
					dimension: address.dimension ?? address.planetaryDimension ?? null,
				},
				{},
			),
			why: normalizeSection(input.why, ""),
			how: normalizeSection(input.how, {}),
			relationships: normalizeSection(input.relationships, []),
			behaviors: normalizeSection(input.behaviors, []),
			dependencies: normalizeSection(input.dependencies, []),
			when: normalizeSection(input.when, {}),
			provenance: normalizeSection(input.provenance, {}),
			metadata: Object.freeze({ ...(input.metadata || {}) }),
		};
		record.transition = deriveTransitionDescriptor(record, input.transition ?? null);
		record.ready = REQUIRED_SECTIONS.every(
			(key) => record[key]?.status === "checked",
		);
		record.unresolved = Object.freeze(
			REQUIRED_SECTIONS.filter((key) => record[key]?.status !== "checked"),
		);
		record.intakeOrder = Object.freeze([
			"address",
			...REQUIRED_SECTIONS,
		]);
		const frozen = Object.freeze(record);
		this.records.set(id, frozen);
		this.intake.push(Object.freeze({
			id,
			address,
			ready: frozen.ready,
			at: new Date().toISOString(),
		}));
		return frozen;
	}

	requireReady(id) {
		const record = this.get(id);
		if (!record) throw new Error(`Unknown component identity: ${id}`);
		if (!record.ready) {
			throw new Error(
				`Component ${id} is unresolved: ${record.unresolved.join(", ")}`,
			);
		}
		return record;
	}

	get(id) {
		return this.records.get(String(id)) || null;
	}

	has(id) {
		return this.records.has(String(id));
	}

	list({ ready = null } = {}) {
		return Object.freeze(
			[...this.records.values()]
				.filter((record) => ready === null || record.ready === ready)
				.sort((left, right) => left.id.localeCompare(right.id)),
		);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.component-registry.v1",
			count: this.records.size,
			ready: this.list({ ready: true }).length,
			unresolved: this.list({ ready: false }).length,
			records: this.list(),
			intake: Object.freeze([...this.intake]),
		});
	}
}

export const REQUIRED_IDENTITY_SECTIONS = REQUIRED_SECTIONS;
export default new ComponentRegistry();

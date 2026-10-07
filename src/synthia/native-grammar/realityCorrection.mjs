
function comparable(value) {
	if (value == null) return null;
	if (["string", "number", "boolean"].includes(typeof value)) return value;
	if (Array.isArray(value)) return value.map(comparable);
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => !["at", "timestamp", "id"].includes(key))
				.map(([key, item]) => [key, comparable(item)]),
		);
	}
	return String(value);
}

function flatten(value, prefix = "", out = new Map()) {
	const normalized = comparable(value);
	if (normalized === null || normalized === undefined) return out;
	if (Array.isArray(normalized)) {
		normalized.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
		return out;
	}
	if (typeof normalized === "object") {
		for (const [key, item] of Object.entries(normalized)) {
			flatten(item, prefix ? `${prefix}.${key}` : key, out);
		}
		return out;
	}
	out.set(prefix || "value", normalized);
	return out;
}

function similarity(predicted, observed) {
	const left = flatten(predicted);
	const right = flatten(observed);
	const keys = [...new Set([...left.keys(), ...right.keys()])];
	if (!keys.length) return null;
	let comparableCount = 0;
	let matches = 0;
	for (const key of keys) {
		if (!left.has(key) || !right.has(key)) continue;
		comparableCount += 1;
		if (Object.is(left.get(key), right.get(key))) matches += 1;
	}
	return comparableCount ? matches / comparableCount : null;
}

export class RealityCorrectionMemory {
	constructor({ limit = 512 } = {}) {
		this.limit = limit;
		this.records = [];
		this.associations = new Map();
	}

	test(hypothesis, observed, {
		evidence = [],
		comparator = similarity,
	} = {}) {
		if (observed === undefined || observed === null) {
			return Object.freeze({
				status: "unresolved",
				score: null,
				hypothesis: structuredClone(hypothesis),
				observed: null,
				evidence: Object.freeze([...evidence]),
				reason: "No observation was supplied; unresolved does not mean absent.",
			});
		}

		const score = comparator(hypothesis, observed);
		let status = "unresolved";
		if (score !== null) {
			if (score >= 0.8) status = "supported";
			else if (score >= 0.5) status = "conditional";
			else status = "contradicted";
		}
		return Object.freeze({
			status,
			score,
			hypothesis: structuredClone(hypothesis),
			observed: structuredClone(observed),
			evidence: Object.freeze([...evidence]),
			reason:
				score === null
					? "Prediction and observation had no directly comparable fields."
					: null,
		});
	}

	remember(record) {
		const frozen = Object.freeze({
			...record,
			at: new Date().toISOString(),
		});
		this.records.unshift(frozen);
		this.records.length = Math.min(this.records.length, this.limit);
		return frozen;
	}

	observeAssociation(key, {
		value,
		status = "unresolved",
		source = "observation",
	} = {}) {
		const id = String(key);
		const current = this.associations.get(id) || {
			support: 0,
			contradiction: 0,
			conditional: 0,
			unresolved: 0,
			values: new Map(),
		};
		if (status === "supported") current.support += 1;
		else if (status === "contradicted") current.contradiction += 1;
		else if (status === "conditional") current.conditional += 1;
		else current.unresolved += 1;
		const valueKey = JSON.stringify(comparable(value));
		const observed = current.values.get(valueKey) || { count: 0, sources: new Set() };
		observed.count += 1;
		observed.sources.add(String(source));
		current.values.set(valueKey, observed);
		this.associations.set(id, current);
		return this.association(id);
	}

	association(key) {
		const current = this.associations.get(String(key));
		if (!current) return null;
		const total =
			current.support +
			current.contradiction +
			current.conditional +
			current.unresolved;
		return Object.freeze({
			key: String(key),
			support: current.support,
			contradiction: current.contradiction,
			conditional: current.conditional,
			unresolved: current.unresolved,
			confidence:
				total === 0
					? 0
					: (current.support + current.conditional * 0.5) / total,
			values: Object.freeze(
				[...current.values.entries()].map(([value, info]) =>
					Object.freeze({
						value: JSON.parse(value),
						count: info.count,
						sources: Object.freeze([...info.sources]),
					}),
				),
			),
		});
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.native-grammar.reality-memory.v1",
			records: Object.freeze(this.records.slice(0, 64)),
			associationCount: this.associations.size,
		});
	}
}

export default new RealityCorrectionMemory();

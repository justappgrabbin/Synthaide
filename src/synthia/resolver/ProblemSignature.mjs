function normalizeAtom(value) {
	if (value == null) return null;
	if (typeof value === "string") return value.trim() || null;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (typeof value === "object") {
		if (typeof value.id === "string" && value.id.trim()) return value.id.trim();
		if (typeof value.state === "string" && value.state.trim()) return value.state.trim();
	}
	return null;
}

export function normalizeState(value) {
	if (value == null) return Object.freeze([]);
	const source = Array.isArray(value) ? value : [value];
	const atoms = new Set();

	for (const item of source) {
		if (item && typeof item === "object" && !Array.isArray(item)) {
			if (typeof item.id === "string" || typeof item.state === "string") {
				const atom = normalizeAtom(item);
				if (atom) atoms.add(atom);
				continue;
			}
			for (const [key, entry] of Object.entries(item)) {
				if (entry === true) atoms.add(String(key));
				else if (entry === false || entry == null) continue;
				else if (["string", "number"].includes(typeof entry)) {
					atoms.add(`${key}:${String(entry)}`);
				}
			}
			continue;
		}
		const atom = normalizeAtom(item);
		if (atom) atoms.add(atom);
	}

	return Object.freeze([...atoms].sort());
}

export function difference(current, desired) {
	const have = new Set(normalizeState(current));
	return Object.freeze(
		normalizeState(desired).filter((atom) => !have.has(atom)),
	);
}

export class ProblemSignature {
	constructor({
		current = [],
		desired = [],
		context = {},
		scale = null,
		source = "runtime",
	} = {}) {
		this.current = normalizeState(current);
		this.desired = normalizeState(desired);
		this.missing = difference(this.current, this.desired);
		this.context = Object.freeze(structuredClone(context || {}));
		this.scale = scale;
		this.source = String(source || "runtime");
		Object.freeze(this);
	}

	get resolved() {
		return this.missing.length === 0;
	}

	toJSON() {
		return {
			current: this.current,
			desired: this.desired,
			missing: this.missing,
			context: this.context,
			scale: this.scale,
			source: this.source,
			resolved: this.resolved,
		};
	}
}

export default ProblemSignature;

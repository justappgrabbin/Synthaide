const CAPABILITY_KINDS = Object.freeze([
	"action",
	"direction",
	"social",
	"mind",
	"heart",
]);

function freezeRecord(record) {
	return Object.freeze({
		...record,
		capabilities: Object.freeze([...(record.capabilities || [])]),
		metadata: Object.freeze({ ...(record.metadata || {}) }),
	});
}

export class CapabilityBodyError extends Error {
	constructor(code, message, details = {}) {
		super(message);
		this.name = "CapabilityBodyError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

/**
 * The body is a residency boundary, not the whole of Synthia.
 *
 * Only active physical/actionable tools consume one of the 26 body slots.
 * Mind, heart, directional, and social components remain addressable without
 * being mislabeled as physical tools. Every component is sovereign: matching
 * a capability only invites it to a task; its agreement hook decides whether
 * it participates in that particular request.
 */
export class CapabilityBody extends EventTarget {
	constructor({ maxActiveActionTools = 26 } = {}) {
		super();
		if (!Number.isInteger(maxActiveActionTools) || maxActiveActionTools < 1) {
			throw new TypeError("maxActiveActionTools must be a positive integer");
		}
		this.maxActiveActionTools = maxActiveActionTools;
		this.components = new Map();
		this.activeActionTools = new Set();
		this.history = [];
	}

	register({
		id,
		kind,
		capabilities = [],
		agree,
		execute = null,
		active = kind !== "action",
		metadata = {},
	} = {}) {
		if (!id || typeof id !== "string") {
			throw new CapabilityBodyError("MISSING_ID", "A body component requires an id");
		}
		if (!CAPABILITY_KINDS.includes(kind)) {
			throw new CapabilityBodyError("INVALID_KIND", `Unknown capability kind: ${kind}`);
		}
		if (this.components.has(id)) {
			throw new CapabilityBodyError("DUPLICATE_COMPONENT", `Component already registered: ${id}`);
		}
		if (typeof agree !== "function") {
			throw new CapabilityBodyError(
				"MISSING_AGREEMENT",
				`Sovereign component ${id} requires an agreement hook`,
			);
		}
		if (kind === "action" && typeof execute !== "function") {
			throw new CapabilityBodyError(
				"MISSING_EXECUTOR",
				`Action component ${id} requires an executor`,
			);
		}

		const record = freezeRecord({
			id,
			kind,
			capabilities: [...new Set(capabilities.map(String))].sort(),
			agree,
			execute,
			metadata,
		});
		this.components.set(id, record);
		if (kind === "action" && active) this.activate(id);
		return record;
	}

	activate(id) {
		const component = this.#require(id);
		if (component.kind !== "action") return component;
		if (this.activeActionTools.has(id)) return component;
		if (this.activeActionTools.size >= this.maxActiveActionTools) {
			throw new CapabilityBodyError(
				"ACTION_TOOL_CEILING",
				`The body already has ${this.maxActiveActionTools} active action tools`,
				{ id, active: [...this.activeActionTools] },
			);
		}
		this.activeActionTools.add(id);
		this.#record("activated", { id });
		return component;
	}

	deactivate(id) {
		const removed = this.activeActionTools.delete(String(id));
		if (removed) this.#record("deactivated", { id: String(id) });
		return removed;
	}

	/**
	 * Recompose the active action body from the present resonance field.
	 * Signals may arise from transits, channels, goals, purpose, relationships,
	 * designs, games, animation paths, or later evidence types. Twenty-six is
	 * only the maximum size of the resulting action expression.
	 */
	selectByResonance(field = []) {
		const candidates = (Array.isArray(field) ? field : [])
			.map((signal) => ({
				id: String(signal?.id || ""),
				resonance: Number(signal?.resonance ?? signal?.score ?? 0),
				expression: String(signal?.expression || signal?.role || "action"),
				evidence: Object.freeze({ ...(signal?.evidence || signal?.transit || {}) }),
			}))
			.filter((signal) => {
				const component = this.components.get(signal.id);
				return component?.kind === "action" &&
					Number.isFinite(signal.resonance) &&
					signal.resonance > 0 &&
					Object.keys(signal.evidence).length > 0;
			})
			.sort((a, b) => b.resonance - a.resonance || a.id.localeCompare(b.id));

		const selectedSignals = candidates.slice(0, this.maxActiveActionTools);
		const selected = new Set(selectedSignals.map((signal) => signal.id));
		const previous = new Set(this.activeActionTools);
		this.activeActionTools = selected;
		const result = Object.freeze({
			active: Object.freeze(selectedSignals),
			activated: Object.freeze([...selected].filter((id) => !previous.has(id))),
			deactivated: Object.freeze([...previous].filter((id) => !selected.has(id))),
			unexpressed: Object.freeze(candidates.slice(this.maxActiveActionTools)),
			candidateCount: candidates.length,
		});
		this.#record("resonance-selected", result);
		return result;
	}

	find(capability, { kind = null, activeOnly = true } = {}) {
		return Object.freeze(
			[...this.components.values()]
				.filter((component) => !kind || component.kind === kind)
				.filter((component) => component.capabilities.includes(String(capability)))
				.filter((component) =>
					!activeOnly || component.kind !== "action" || this.activeActionTools.has(component.id)
				)
				.map((component) => this.#public(component)),
		);
	}

	async request(id, task, context = {}) {
		const component = this.#require(id);
		if (component.kind === "action" && !this.activeActionTools.has(id)) {
			return this.#result(component, "unavailable", null, "ACTION_TOOL_NOT_ACTIVE");
		}

		let decision;
		try {
			decision = await component.agree(task, Object.freeze({
				...context,
				component: this.#public(component),
			}));
		} catch (error) {
			return this.#result(component, "declined", null, "AGREEMENT_ERROR", error);
		}

		const agreed = decision === true || decision?.agreed === true;
		if (!agreed) {
			return this.#result(
				component,
				"declined",
				null,
				decision?.reason || "COMPONENT_DECLINED",
			);
		}
		if (typeof component.execute !== "function") {
			return this.#result(component, "agreed", decision?.response ?? null, null);
		}

		try {
			const output = await component.execute(task, Object.freeze({
				...context,
				agreement: decision,
				component: this.#public(component),
			}));
			return this.#result(component, "completed", output, null);
		} catch (error) {
			return this.#result(component, "failed", null, "EXECUTION_FAILED", error);
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.capability-body.v1",
			maxActiveActionTools: this.maxActiveActionTools,
			activeActionToolCount: this.activeActionTools.size,
			activeActionTools: Object.freeze([...this.activeActionTools].sort()),
			components: Object.freeze(
				[...this.components.values()]
					.map((component) => this.#public(component))
					.sort((a, b) => a.id.localeCompare(b.id)),
			),
			history: Object.freeze([...this.history]),
		});
	}

	#require(id) {
		const component = this.components.get(String(id));
		if (!component) {
			throw new CapabilityBodyError("UNKNOWN_COMPONENT", `Unknown body component: ${id}`);
		}
		return component;
	}

	#public(component) {
		return Object.freeze({
			id: component.id,
			kind: component.kind,
			capabilities: component.capabilities,
			active: component.kind !== "action" || this.activeActionTools.has(component.id),
			metadata: component.metadata,
		});
	}

	#result(component, status, output, reason, error = null) {
		const result = Object.freeze({
			componentId: component.id,
			status,
			output,
			reason,
			...(error ? { error: String(error.message || error) } : {}),
		});
		this.#record("request", result);
		return result;
	}

	#record(type, detail) {
		const event = Object.freeze({ type, ...detail, at: new Date().toISOString() });
		this.history.unshift(event);
		this.history.length = Math.min(this.history.length, 200);
		this.dispatchEvent(new CustomEvent(type, { detail: event }));
	}
}

export { CAPABILITY_KINDS };

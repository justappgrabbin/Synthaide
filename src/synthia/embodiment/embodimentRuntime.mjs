import { CapabilityBody } from "./capabilityBody.mjs";

function hostAgreement(host, operation) {
	return async (task, context) => {
		if (!host.available()) return { agreed: false, reason: "HOST_CAPABILITY_UNAVAILABLE" };
		if (!host.permitted(operation, task, context)) {
			return { agreed: false, reason: "HOST_PERMISSION_DECLINED" };
		}
		return { agreed: true, operation };
	};
}

/**
 * Host adapters are deliberately injected. Synthia cannot infer that a hand,
 * browser, or network exists merely because another component can describe it.
 */
export class EmbodimentRuntime {
	constructor({ maxActiveActionTools = 26 } = {}) {
		this.id = "synthia-embodiment";
		this.address = Object.freeze({
			mode: "macro",
			gate: 2,
			line: 1,
			color: 1,
			tone: 1,
			base: 1,
			dimension: "Being",
		});
		this.capabilities = Object.freeze([
			"body.capability.find",
			"body.component.request",
			"body.action.activate",
			"body.action.deactivate",
		]);
		this.metadata = Object.freeze({
			independent: true,
			sovereign: true,
			capabilities: this.capabilities,
		});
		this.body = new CapabilityBody({ maxActiveActionTools });
		this.hosts = new Map();

		this.body.register({
			id: "synthia-mind",
			kind: "mind",
			capabilities: ["reason", "address", "plan"],
			agree: () => ({ agreed: true }),
			metadata: { residency: "core", consumesActionSlot: false },
		});
		this.body.register({
			id: "synthia-heart",
			kind: "heart",
			capabilities: ["value", "care", "coherence"],
			agree: () => ({ agreed: true }),
			metadata: { residency: "core", consumesActionSlot: false },
		});
	}

	bindHost({ id, capabilities, available, permitted, execute, active = true }) {
		const host = Object.freeze({
			available: typeof available === "function" ? available : () => false,
			permitted: typeof permitted === "function" ? permitted : () => false,
			execute,
		});
		if (typeof execute !== "function") throw new TypeError(`Host ${id} requires execute()`);
		this.hosts.set(id, host);
		return this.body.register({
			id,
			kind: "action",
			capabilities,
			agree: hostAgreement(host, id),
			execute: (task, context) => host.execute(task, context),
			active,
			metadata: { hostBound: true, sovereign: true, consumesActionSlot: true },
		});
	}

	request(id, task, context) {
		return this.body.request(id, task, context);
	}

	run(input = {}, context = {}) {
		switch (input.op) {
			case "find":
				return this.body.find(input.capability, input.options);
			case "request":
				return this.request(input.id, input.task, context);
			case "activate":
				return this.body.activate(input.id);
			case "deactivate":
				return this.body.deactivate(input.id);
			default:
				throw new RangeError(`Unknown embodiment operation: ${input.op}`);
		}
	}

	snapshot() {
		return this.body.snapshot();
	}
}

export default new EmbodimentRuntime();

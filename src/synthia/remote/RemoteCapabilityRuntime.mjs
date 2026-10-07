import embodiment from "../embodiment/embodimentRuntime.mjs";
import morphSubstrate from "../morph-engine/substrateRuntime.mjs";
import TransitionDescriptor from "../resolver/TransitionDescriptor.mjs";
import CapabilityCatalog from "./CapabilityCatalog.mjs";
import browserModuleLoader from "./browserModuleLoader.mjs";

function bytesToText(bytes) {
	if (typeof bytes === "string") return bytes;
	if (bytes instanceof ArrayBuffer) return new TextDecoder().decode(bytes);
	if (ArrayBuffer.isView(bytes)) return new TextDecoder().decode(bytes);
	throw new TypeError("Retrieved artifact did not contain text-compatible bytes");
}

function moduleContract(module, entry) {
	const manifest = typeof module.manifest === "function" ? module.manifest() : module.manifest;
	const id = manifest?.id || module.id;
	const agree = module.agree || module.default?.agree;
	const execute = module.execute || module.default?.execute || module.default;
	if (id !== entry.id) throw new Error(`Loaded module identity ${id || "<missing>"} does not match ${entry.id}`);
	if (typeof agree !== "function") throw new Error(`Remote module ${entry.id} has no sovereign agree() export`);
	if (typeof execute !== "function") throw new Error(`Remote module ${entry.id} has no execute() export`);
	return { manifest, agree, execute };
}

/** Address -> retrieve -> verify -> Morph decision -> inactive registration -> activation. */
export class RemoteCapabilityRuntime {
	constructor({
		catalog = new CapabilityCatalog(),
		body = embodiment.body,
		sandbox = morphSubstrate.sandbox,
		retrieve = (entry) => embodiment.request("synthia-artifact-retriever", entry),
		loadModule = browserModuleLoader,
		morphInvite = async ({ verification }) => ({
			agreed: verification?.passed === true,
			reason: verification?.passed ? "VERIFIED_CANDIDATE" : "SANDBOX_FAILED",
		}),
		transitionResolver = null,
	} = {}) {
		this.id = "synthia-remote-capability-runtime";
		this.address = Object.freeze({ mode: "macro", gate: 4, line: 1, color: 1, tone: 1, base: 1, dimension: "Space" });
		this.capabilities = Object.freeze([
			"capability.catalog",
			"capability.resolve",
			"artifact.retrieve",
			"artifact.verify",
			"morph.invite",
			"capability.activate",
		]);
		this.metadata = Object.freeze({ independent: true, capabilities: this.capabilities });
		this.catalog = catalog;
		this.body = body;
		this.sandbox = sandbox;
		this.retrieve = retrieve;
		this.loadModule = loadModule;
		this.morphInvite = morphInvite;
		this.transitionResolver = transitionResolver;
		this.history = [];
	}

	register(entry) {
		const registered = this.catalog.register(entry);
		this.#registerTransition(registered);
		return registered;
	}

	boot() {
		this.catalog.hydrate();
		for (const entry of this.catalog.entries.values()) this.#registerTransition(entry);
		return this.snapshot();
	}

	connectTransitionResolver(resolver) {
		if (!resolver || typeof resolver.register !== "function" || typeof resolver.solve !== "function") {
			throw new TypeError("A TransitionResolver-compatible runtime is required");
		}
		this.transitionResolver = resolver;
		for (const entry of this.catalog.entries.values()) this.#registerTransition(entry);
		return resolver;
	}

	resolve(query) {
		return this.catalog.resolve(query);
	}

	async materialize(id, { activation = null } = {}) {
		const entry = this.catalog.get(id);
		if (!entry) return this.#result(id, "unresolved", "CATALOG_ENTRY_NOT_FOUND");
		if (entry.format !== "esm") return this.#result(id, "preserved", "FORMAT_NOT_ACTIVATABLE");

		const retrieval = await this.retrieve(entry);
		if (retrieval?.status !== "completed" || retrieval.output?.verified !== true) {
			return this.#result(id, "retrieval-declined", retrieval?.reason || "ARTIFACT_NOT_VERIFIED");
		}
		const text = bytesToText(retrieval.output.bytes);
		const asset = Object.freeze({ name: entry.filename, text, kind: "remote-capability" });
		const verification = await this.sandbox.verify([asset], {
			contracts: entry.contracts,
			runtime: false,
		});
		if (!verification.passed) return this.#result(id, "sandbox-failed", "SANDBOX_FAILED", { verification });

		const invitation = await this.morphInvite(Object.freeze({ entry, verification, asset }));
		if (invitation !== true && invitation?.agreed !== true) {
			return this.#result(id, "morph-declined", invitation?.reason || "MORPH_DECLINED");
		}

		const loaded = await this.loadModule({ text, entry, verification });
		const contract = moduleContract(loaded, entry);
		if (!this.body.components.has(entry.id)) {
			this.body.register({
				id: entry.id,
				kind: "action",
				capabilities: entry.capabilities,
				agree: contract.agree,
				execute: contract.execute,
				active: false,
				metadata: {
					remote: true,
					addressKey: entry.addressKey,
					sha256: entry.sha256,
					manifest: contract.manifest || null,
				},
			});
		}
		if (!activation) {
			return this.#result(id, "registered-inactive", "NO_RESONANCE_EVIDENCE", { verification });
		}
		const expression = this.body.selectByResonance(
			activation.field || [{ id: entry.id, ...activation }],
		);
		const active = expression.active.some((signal) => signal.id === entry.id);
		return this.#result(
			id,
			active ? "activated-by-resonance" : "unexpressed-by-resonance",
			active ? null : "NOT_SELECTED_BY_CURRENT_FIELD",
			{ verification, expression },
		);
	}

	async solve(current, desired, options = {}) {
		if (!this.transitionResolver) {
			return this.#result(null, "unresolved", "TRANSITION_RESOLVER_NOT_CONNECTED");
		}
		return this.transitionResolver.solve(current, desired, {
			...options,
			activate: async (descriptor, context) => {
				const activation = options.activationFor?.(descriptor, context) || options.activation || null;
				const materialized = await this.materialize(descriptor.componentId, { activation });
				if (materialized.status !== "activated-by-resonance") return materialized;
				return this.body.request(descriptor.componentId, {
					op: "transition",
					current: context.current,
					desired: context.desired,
					context: context.context,
				}, { transition: descriptor.toJSON() });
			},
		});
	}

	deactivate(id) {
		return this.body.deactivate(id);
	}

	async run(input = {}) {
		switch (input.op) {
			case "register": return this.register(input.entry || input);
			case "resolve": return this.resolve(input.query || input);
			case "materialize": return this.materialize(input.id, input.options || input);
			case "solve": return this.solve(input.current, input.desired, input.options || input);
			case "boot": return this.boot();
			case "deactivate": return this.deactivate(input.id);
			case "snapshot": return this.snapshot();
			default: throw new Error(`Unknown remote capability operation: ${input.op}`);
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.remote-capability-runtime.v1",
			catalog: this.catalog.snapshot(),
			history: Object.freeze([...this.history]),
		});
	}

	#result(id, status, reason = null, detail = {}) {
		const result = Object.freeze({ id, status, reason, ...detail, at: new Date().toISOString() });
		this.history.unshift(result);
		this.history.length = Math.min(this.history.length, 100);
		return result;
	}

	#registerTransition(entry) {
		if (!this.transitionResolver || !entry.transition.produces.length) return null;
		return this.transitionResolver.register(new TransitionDescriptor({
			componentId: entry.id,
			address: entry.address,
			accepts: entry.transition.accepts,
			produces: entry.transition.produces,
			triggers: ["remote-capability-required"],
			provenance: {
				source: "remote-capability-catalog",
				url: entry.url,
				sha256: entry.sha256,
			},
		}));
	}
}

export default new RemoteCapabilityRuntime();

import componentRegistry from "../identity/componentRegistry.mjs";
import { MorphEngine } from "./substrate/core/MorphEngine.mjs";
import { SandboxVerifier } from "./substrate/sandbox/SandboxVerifier.mjs";
import { SuggestionInbox } from "./substrate/inbox/SuggestionInbox.mjs";
import { PersonalVault } from "./substrate/vault/PersonalVault.mjs";
import { VaultWatcher } from "./substrate/vault/VaultWatcher.mjs";
import { VaultMCPGateway } from "./substrate/vault/VaultMCPGateway.mjs";

const CAPABILITIES = Object.freeze([
	"artifact.inspect", "artifact.morph", "asset.graph", "gap.detect",
	"interface.infer", "bridge.build", "sandbox.verify", "suggestion.govern",
	"vault.preserve", "vault.search", "vault.related", "vault.watch",
	"vault.copy-to-workboard", "vault.lineage", "vault.thread", "mcp.capability-ticket",
]);

function identify() {
	if (componentRegistry.has("synthia-morph-substrate")) {
		return componentRegistry.get("synthia-morph-substrate");
	}
	return componentRegistry.identify({
		id: "synthia-morph-substrate",
		name: "Synthia Morph Substrate v0.6",
		kind: "component",
		what: { capabilities: CAPABILITIES },
		why: "Turns addressed artifacts and detected gaps into governed bridge candidates while preserving every original.",
		how: { pipeline: "intake -> immutable vault -> asset graph -> gap -> interface -> bridge -> sandbox -> inbox -> approved copy" },
		relationships: [
			{ type: "supports", target: "synthia-self-integration" },
			{ type: "governs-copies-for", target: "synthia-morph-change" },
		],
		behaviors: CAPABILITIES.map((capability) => `provides:${capability}`),
		dependencies: ["component-registry", "synthia-morph-change"],
		when: { activation: "artifact intake, relationship gap, vault search, or approved build request" },
		provenance: { source: "synthia-morph-engine-v0.6-personal-vault", form: "complete-integrated-runtime" },
	});
}

export class MorphSubstrateRuntime {
	constructor({ engine, vault, watcher, gateway, sandbox, inbox } = {}) {
		this.id = "synthia-morph-substrate";
		this.engine = engine || new MorphEngine();
		this.vault = vault || new PersonalVault();
		this.watcher = watcher || new VaultWatcher({ vault: this.vault });
		this.gateway = gateway || new VaultMCPGateway({ vault: this.vault });
		this.sandbox = sandbox || new SandboxVerifier();
		this.inbox = inbox || new SuggestionInbox();
		this.identity = identify();
		this.address = this.identity.address;
		this.capabilities = CAPABILITIES;
	}

	async intake(inputs, options = {}) {
		const list = Array.from(inputs || []);
		const preserved = [];
		for (const input of list) {
			preserved.push(await this.vault.preserve(input, {
				source: options.source || "Synthia Morph intake",
				path: input.webkitRelativePath || input.name || "artifact",
				tier: options.tier || "important",
				provenance: options.provenance || { receivedBy: this.id },
			}));
		}
		const diagnosis = await this.engine.diagnose(list, options);
		return Object.freeze({ preserved: Object.freeze(preserved), diagnosis });
	}

	async run(input = {}) {
		switch (input.op) {
			case "intake": return this.intake(input.inputs, input.options);
			case "diagnose": return this.engine.diagnose(input.inputs || [], input.options);
			case "morph": return this.engine.morph(input.inputs || [], input.intent || {});
			case "infer-gap": return this.engine.inferGap(input.inputs || [], input.gap, input.options);
			case "build-bridge": return this.engine.buildBridge(input.inputs || [], input.gap, input.options);
			case "verify": return this.sandbox.verify(input.assets || [], input.options || {});
			case "vault-search": return this.vault.search(input.query || "", input.options || {});
			case "vault-related": return this.vault.related(input.artifactId, input.options || {});
			case "vault-copy": return this.vault.createWorkCopy(input.artifactId, input.options || {});
			case "vault-thread": return this.vault.createThread(input.thread || {});
			case "mcp-ticket": return this.gateway.issueTicket(input.ticket || {});
			default: throw new Error(`Unknown Morph Substrate operation: ${input.op}`);
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.morph-substrate.v0.6-integrated",
			id: this.id,
			address: this.address,
			capabilities: this.capabilities,
			vault: Object.freeze({ persistence: this.vault.store.constructor.name }),
			watching: Object.freeze({ active: Boolean(this.watcher.timer), roots: this.watcher.roots.size }),
		});
	}
}

export default new MorphSubstrateRuntime();

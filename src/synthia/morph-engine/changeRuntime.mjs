
import componentRegistry from "../identity/componentRegistry.mjs";
import { ASTProjectRewriter } from "./ast/ASTProjectRewriter.mjs";
import { rewriteFromPrompt } from "./ast/intent.mjs";
import { SandboxVerifier } from "./sandbox/SandboxVerifier.mjs";
import {
	MemoryStore,
	SuggestionInbox,
} from "./inbox/SuggestionInbox.mjs";
import { SuggestionPipeline } from "./inbox/SuggestionPipeline.mjs";
import { IdleSuggestionScout } from "./inbox/IdleSuggestionScout.mjs";
import { applySuggestionToAssets } from "./inbox/applySuggestion.mjs";

function capabilities() {
	return Object.freeze([
		"project.analyze",
		"project.rewrite",
		"sandbox.verify",
		"suggestion.propose",
		"suggestion.list",
		"suggestion.approve",
		"suggestion.reject",
		"suggestion.apply",
		"idle.suggest",
	]);
}

class ASTSuggestionEngine {
	constructor({ rewriter = new ASTProjectRewriter() } = {}) {
		this.rewriter = rewriter;
	}

	async morph(inputs = [], intent = {}) {
		const rewrite =
			intent.rewrite ||
			rewriteFromPrompt(intent.prompt || "") ||
			{ operations: intent.operations || [] };
		const result = this.rewriter.rewrite(inputs, rewrite);
		return Object.freeze({
			kind: "morph-change-result",
			identity: Object.freeze({
				source: "morph-ast",
				invariants: Object.freeze(["declared-exports", "parse-validity"]),
			}),
			plan: Object.freeze({
				mode: "ast-project-rewrite",
				target: intent.target || "current-project",
				prompt: intent.prompt || "",
			}),
			results: Object.freeze([result]),
		});
	}
}

function identifyInternal({
	id,
	name,
	what,
	why,
	how,
	relationships = [],
	behaviors = [],
	dependencies = [],
	when = { activation: "on-demand" },
	provenance = {
		source: "synthia-morph-engine-v0.3-sandbox-inbox",
		form: "integrated-derived-runtime",
	},
}) {
	if (componentRegistry.has(id)) return componentRegistry.get(id);
	return componentRegistry.identify({
		id,
		name,
		kind: "component",
		what,
		why,
		how,
		relationships,
		behaviors,
		dependencies,
		when,
		provenance,
	});
}

export class MorphChangeRuntime {
	constructor({
		storage = null,
		rewriter = new ASTProjectRewriter(),
		sandbox = new SandboxVerifier(),
	} = {}) {
		this.id = "synthia-morph-change";
		this.rewriter = rewriter;
		this.sandbox = sandbox;
		this.inbox = new SuggestionInbox({
			storage: storage || new MemoryStore(),
			key: "synthia.morph.change.inbox.v1",
		});
		this.engine = new ASTSuggestionEngine({ rewriter });
		this.pipeline = new SuggestionPipeline({
			engine: this.engine,
			inbox: this.inbox,
			sandbox,
		});
		this.assetsProvider = null;
		this.intentProvider = null;
		this.installer = null;

		const identity = identifyInternal({
			id: this.id,
			name: "Morph Change Runtime",
			what: {
				capabilities: capabilities(),
				components: [
					"morph-ast-rewriter",
					"morph-sandbox-verifier",
					"morph-suggestion-inbox",
					"morph-idle-scout",
					"morph-change-applicator",
				],
			},
			why:
				"Provides a quarantined, testable path for Synthia to propose and apply source changes without mutating the live project directly.",
			how: {
				pipeline:
					"analyze -> rewrite candidate -> sandbox -> inbox -> approve -> apply",
			},
			relationships: [
				{ type: "supports", target: "synthia-gap-detector" },
				{ type: "supports", target: "synthia-self-integration" },
			],
			behaviors: [
				"analyze-source",
				"rewrite-source",
				"verify-candidate",
				"queue-suggestion",
				"record-decision",
				"apply-approved-change",
			],
			dependencies: [
				"acorn-parser",
				"addressed-source-assets",
			],
			when: {
				activation:
					"explicit change request, detected gap, or idle improvement scan",
			},
		});
		this.address = identity.address;
		this.capabilities = capabilities();

		this.#identifyChildren();
	}

	#identifyChildren() {
		identifyInternal({
			id: "morph-ast-rewriter",
			name: "Morph AST Rewriter",
			what: { capabilities: ["project.analyze", "project.rewrite"] },
			why: "Performs structural JavaScript project rewrites while preserving declared contracts.",
			how: { mechanism: "Acorn AST analysis and verified source edits" },
			relationships: [{ type: "contained-by", target: this.id }],
			behaviors: ["parse", "analyze", "rewrite", "reparse"],
			dependencies: ["acorn-parser"],
		});
		identifyInternal({
			id: "morph-sandbox-verifier",
			name: "Morph Sandbox Verifier",
			what: { capabilities: ["sandbox.verify"] },
			why: "Tests candidate changes before they can reach the live project.",
			how: { mechanism: "static contracts plus isolated browser runtime where supported" },
			relationships: [{ type: "contained-by", target: this.id }],
			behaviors: ["parse-check", "dependency-check", "contract-check", "runtime-check"],
			dependencies: ["morph-ast-rewriter"],
		});
		identifyInternal({
			id: "morph-suggestion-inbox",
			name: "Morph Suggestion Inbox",
			what: {
				capabilities: [
					"suggestion.list",
					"suggestion.approve",
					"suggestion.reject",
					"suggestion.apply",
				],
			},
			why: "Separates proposal from approval and installation.",
			how: { stateFlow: "pending -> approved/rejected -> applied" },
			relationships: [{ type: "contained-by", target: this.id }],
			behaviors: ["queue", "approve", "reject", "apply-approved-only"],
			dependencies: [],
		});
		identifyInternal({
			id: "morph-idle-scout",
			name: "Morph Idle Suggestion Scout",
			what: { capabilities: ["idle.suggest"] },
			why: "Allows Synthia to inspect for improvements while idle and stop at the suggestion boundary.",
			how: { mechanism: "idle tick -> candidate -> sandbox -> inbox -> stop" },
			relationships: [{ type: "contained-by", target: this.id }],
			behaviors: ["observe-idle", "propose", "stop-before-install"],
			dependencies: ["morph-suggestion-inbox", "morph-sandbox-verifier"],
		});
		identifyInternal({
			id: "morph-change-applicator",
			name: "Morph Change Applicator",
			what: { capabilities: ["suggestion.apply"] },
			why: "Applies only explicitly approved candidate files through an injected installer.",
			how: { mechanism: "approved suggestion -> controlled installer" },
			relationships: [{ type: "contained-by", target: this.id }],
			behaviors: ["apply-approved-change"],
			dependencies: ["morph-suggestion-inbox"],
		});
	}

	configure({
		getAssets = null,
		getIntents = null,
		installer = null,
		isIdle = () => true,
		maxPending = 8,
	} = {}) {
		if (getAssets) this.assetsProvider = getAssets;
		if (getIntents) this.intentProvider = getIntents;
		if (installer) this.installer = installer;

		this.scout =
			this.assetsProvider && this.intentProvider
				? new IdleSuggestionScout({
					pipeline: this.pipeline,
					getInputs: this.assetsProvider,
					getIntents: this.intentProvider,
					isIdle,
					maxPending,
				})
				: null;
		return this;
	}

	async propose({
		assets = null,
		intent = {},
		meta = {},
	} = {}) {
		const sourceAssets =
			assets ||
			(this.assetsProvider ? await this.assetsProvider() : null);
		if (!Array.isArray(sourceAssets)) {
			throw new TypeError("Morph change proposals require project assets.");
		}
		return this.pipeline.propose(sourceAssets, intent, meta);
	}

	async apply(id, {
		assets = null,
		installer = null,
	} = {}) {
		const applyWith = installer || this.installer;
		if (applyWith) {
			return this.inbox.apply(id, applyWith);
		}
		const baseAssets =
			assets ||
			(this.assetsProvider ? await this.assetsProvider() : null);
		if (!Array.isArray(baseAssets)) {
			throw new Error("Applying without an installer requires base assets.");
		}
		return this.inbox.apply(id, async (suggestion) =>
			applySuggestionToAssets(baseAssets, suggestion),
		);
	}

	async run(input = {}) {
		switch (input.op) {
			case "analyze":
				return this.rewriter.analyze(input.assets || []);
			case "rewrite":
				return this.rewriter.rewrite(
					input.assets || [],
					input.rewrite ||
						rewriteFromPrompt(input.prompt || "") ||
						{ operations: input.operations || [] },
				);
			case "verify":
				return this.sandbox.verify(
					input.assets || [],
					input.options || {},
				);
			case "propose":
				return this.propose(input);
			case "list":
				return this.inbox.list(input.filter || {});
			case "approve":
				return this.inbox.approve(input.id, input.note || "");
			case "reject":
				return this.inbox.reject(input.id, input.note || "");
			case "apply":
				return this.apply(input.id, input);
			case "idle-tick":
				if (!this.scout) {
					return Object.freeze({
						status: "not-configured",
						reason: "IDLE_SCOUT_REQUIRES_PROVIDERS",
					});
				}
				return this.scout.tick();
			default:
				throw new Error(`Unknown Morph Change operation: ${input.op}`);
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.morph-change.v1",
			id: this.id,
			address: this.address,
			capabilities: this.capabilities,
			suggestions: Object.freeze(this.inbox.list()),
			idleScoutConfigured: Boolean(this.scout),
		});
	}
}

export default new MorphChangeRuntime();

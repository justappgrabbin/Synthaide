
import componentRegistry from "../identity/componentRegistry.mjs";
import TransitionIndex from "../resolver/TransitionIndex.mjs";
import TransitionResolver from "../resolver/TransitionResolver.mjs";
import AddressSubstrateCalculator from "../resolver/AddressSubstrateCalculator.mjs";
import { AssetGraph } from "./assetGraph.mjs";
import { GapDetector } from "./gapDetector.mjs";
import { ResonanceRelations } from "./resonanceRelations.mjs";
import morphChange from "../morph-engine/changeRuntime.mjs";

function identityFor(id, spec) {
	if (componentRegistry.has(id)) return componentRegistry.get(id);
	return componentRegistry.identify({ id, ...spec });
}

export class SelfIntegrationRuntime {
	constructor({
		meshRuntime,
		changeRuntime = morphChange,
	} = {}) {
		if (!meshRuntime) throw new TypeError("SelfIntegrationRuntime requires LivingMeshRuntime.");
		this.id = "synthia-self-integration";
		this.meshRuntime = meshRuntime;
		this.changeRuntime = changeRuntime;
		this.resonance = new ResonanceRelations({ meshRuntime });
		this.assetGraph = new AssetGraph({
			onRelationship: (edge) => {
				const fromKnown = this.resonance.entities.has(edge.from);
				const toKnown = this.resonance.entities.has(edge.to);
				if (fromKnown && toKnown) {
					this.resonance.relate({
						from: edge.from,
						to: edge.to,
						type: edge.type,
						projection: edge.projection,
						outcome: 0,
						verified: false,
						evidence: edge.evidence,
						metadata: edge.metadata,
					});
				}
			},
		});
		this.gapDetector = new GapDetector();
		this.learningEvidence = [];
		this.transitionIndex = new TransitionIndex();
		this.addressSubstrateCalculator = new AddressSubstrateCalculator();
		this.transitionResolver = new TransitionResolver({
			index: this.transitionIndex,
			resonance: this.meshRuntime.resonance,
			calculator: this.addressSubstrateCalculator,
			activate: async (descriptor, payload) =>
				this.meshRuntime.invoke(descriptor.componentId, payload, {
					context: { source: "transition-resolver" },
				}),
		});

		this.identity = identityFor(this.id, {
			name: "Synthia Self Integration",
			kind: "component",
			what: {
				capabilities: [
					"asset.register",
					"asset.expect",
					"asset.connect",
					"gap.detect",
					"gap.suggest",
					"integration.learn",
				],
			},
			why:
				"Allows Synthia to inspect her addressed parts, detect missing relationships, propose verified repairs, and retain successful wiring evidence.",
			how: {
				pipeline:
					"asset graph -> gap detection -> Morph candidate -> sandbox -> suggestion inbox -> approved apply -> evidence",
			},
			relationships: [
				{ type: "uses", target: "synthia-morph-change" },
				{ type: "uses", target: "synthia-resonance-relations" },
			],
			behaviors: [
				"register-assets",
				"compare-expected-to-actual",
				"propose-repair",
				"record-learned-wiring",
			],
			dependencies: [
				"synthia-morph-change",
				"synthia-resonance-relations",
				"component-registry",
			],
			when: {
				activation:
					"component intake, explicit wiring request, gap scan, or idle inspection",
			},
			provenance: { source: "integrated-runtime" },
		});
		this.address = this.identity.address;
		this.capabilities = Object.freeze(this.identity.what.value.capabilities);

		const assetIdentity = identityFor("synthia-asset-graph", {
			name: "Synthia Asset Graph",
			kind: "component",
			what: {
				capabilities: [
					"asset.register",
					"asset.expect",
					"asset.connect",
					"project.ingest",
				],
			},
			why:
				"Represents addressed people, places, things, source assets, capabilities, and their expected/actual relationships.",
			how: { mechanism: "addressed nodes plus typed relationship edges" },
			relationships: [{ type: "contained-by", target: this.id }],
			behaviors: ["register", "expect", "connect", "ingest-project"],
			dependencies: ["component-registry", "morph-ast-rewriter"],
			when: { activation: "asset or entity intake" },
			provenance: { source: "integrated-runtime" },
		});
		this.assetGraph.id = assetIdentity.id;
		this.assetGraph.address = assetIdentity.address;
		this.assetGraph.capabilities = Object.freeze(assetIdentity.what.value.capabilities);

		const gapIdentity = identityFor("synthia-gap-detector", {
			name: "Synthia Gap Detector",
			kind: "component",
			what: { capabilities: ["gap.detect"] },
			why:
				"Finds missing declared relationships, unresolved imports, and required capabilities without inventing a repair.",
			how: {
				mechanism:
					"compare expected edges/capabilities with observed graph state",
			},
			relationships: [{ type: "contained-by", target: this.id }],
			behaviors: ["detect-missing-relationship", "detect-missing-capability", "detect-unresolved-import"],
			dependencies: ["synthia-asset-graph"],
			when: { activation: "explicit scan or idle inspection" },
			provenance: { source: "integrated-runtime" },
		});
		this.gapDetector.address = gapIdentity.address;
		this.gapDetector.capabilities = Object.freeze(gapIdentity.what.value.capabilities);
	}

	registerEntity(input = {}) {
		const identity = this.assetGraph.registerEntity(input);
		this.resonance.register({
			id: identity.id,
			name: identity.who.value.name,
			kind: identity.who.value.kind,
			address: identity.address,
			what: identity.what.value,
			why: identity.why.value,
			how: identity.how.value,
			relationships: identity.relationships.value,
			behaviors: identity.behaviors.value,
			dependencies: identity.dependencies.value,
			when: identity.when.value,
			provenance: identity.provenance.value,
			capabilities: input.capabilities || identity.what.value.capabilities || [],
			public: input.public || {},
		});
		if (identity.transition) this.transitionResolver.register(identity.transition);
		return identity;
	}

	registerIdentity(identity, { capabilities = [] } = {}) {
		componentRegistry.requireReady(identity.id);
		this.assetGraph.addIdentity(identity, {
			kind: identity.who.value.kind,
			capabilities,
		});
		this.resonance.register({
			id: identity.id,
			name: identity.who.value.name,
			kind: identity.who.value.kind,
			address: identity.address,
			what: identity.what.value,
			why: identity.why.value,
			how: identity.how.value,
			relationships: identity.relationships.value,
			behaviors: identity.behaviors.value,
			dependencies: identity.dependencies.value,
			when: identity.when.value,
			provenance: identity.provenance.value,
			capabilities,
		});
		if (identity.transition) this.transitionResolver.register(identity.transition);
		return identity;
	}

	detect(options = {}) {
		return this.gapDetector.detect(this.assetGraph, options);
	}

	async suggestGap(gap, {
		assets,
		rewrite = null,
		prompt = "",
		meta = {},
	} = {}) {
		if (!gap) throw new TypeError("suggestGap requires a detected gap.");
		const title =
			gap.kind === "missing-relationship"
				? `Connect ${gap.from} → ${gap.to}`
				: `Resolve ${gap.kind}`;
		if (!rewrite && !prompt) {
			return this.changeRuntime.inbox.submit({
				title,
				why: `Detected ${gap.kind} in the addressed Asset Graph.`,
				what: "A wiring gap was detected, but no source transformation has been inferred yet.",
				does: "Records the gap for explicit design or MCP escalation without modifying the live project.",
				expectedBenefit: "Restore the missing relationship while preserving existing contracts.",
				risk: "needs-design",
				scope: [],
				provenance: {
					source: "synthia-gap-detector",
					createdBy: this.id,
					gap,
				},
				evidence: [{ type: "asset-graph-gap", gap }],
				verification: null,
				files: [],
			});
		}
		return this.changeRuntime.propose({
			assets,
			intent: {
				prompt,
				rewrite,
				target: gap.from || "current-project",
			},
			meta: {
				title,
				why: `Detected ${gap.kind}; constructing a candidate repair before touching the live project.`,
				what: `Candidate repair for ${gap.kind}.`,
				does: "Produces a sandboxed source candidate only.",
				createdBy: this.id,
				...meta,
			},
		});
	}

	learn({
		problem,
		context = {},
		procedure,
		result,
		tests = [],
		rule,
	} = {}) {
		const evidence = Object.freeze({
			id: `integration-evidence-${this.learningEvidence.length + 1}`,
			problem: String(problem || ""),
			context: structuredClone(context),
			procedure: structuredClone(procedure ?? null),
			result: structuredClone(result ?? null),
			tests: Object.freeze([...tests]),
			learnedIntegrationRule: structuredClone(rule ?? null),
			at: new Date().toISOString(),
		});
		this.learningEvidence.unshift(evidence);
		this.learningEvidence.length = Math.min(this.learningEvidence.length, 128);
		return evidence;
	}

	async run(input = {}) {
		switch (input.op) {
			case "register":
				return this.registerEntity(input.entity || input);
			case "expect":
				return this.assetGraph.expect(input.from, input.to, input.relationship || input);
			case "connect":
				return this.assetGraph.connect(input.from, input.to, input.relationship || input);
			case "ingest-project":
				return this.assetGraph.ingestProject(input.assets || [], input.options || {});
			case "detect":
				return this.detect(input.options || {});
			case "transition-resolve":
				return this.transitionResolver.resolve(input.current, input.desired, input.options || input);
			case "transition-plan":
				return this.transitionResolver.plan(input.current, input.desired, input.options || input);
			case "transition-solve":
				return this.transitionResolver.solve(input.current, input.desired, input.options || input);
			case "suggest":
				return this.suggestGap(input.gap, input);
			case "learn":
				return this.learn(input);
			case "snapshot":
				return this.snapshot();
			default:
				throw new Error(`Unknown Self Integration operation: ${input.op}`);
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.self-integration.v1",
			assetGraph: this.assetGraph.snapshot(),
			gaps: this.gapDetector.snapshot(),
			morphChange: this.changeRuntime.snapshot(),
			resonance: this.resonance.snapshot(),
			learningEvidence: Object.freeze([...this.learningEvidence]),
			transitionResolver: this.transitionResolver.snapshot(),
			addressSubstrateCalculator: this.addressSubstrateCalculator.snapshot(),
		});
	}
}

export default SelfIntegrationRuntime;

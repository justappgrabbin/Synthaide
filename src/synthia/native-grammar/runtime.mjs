
import componentRegistry from "../identity/componentRegistry.mjs";
import primitiveLexicon, { PrimitiveLexicon } from "./primitiveLexicon.mjs";
import positionGrammar, { PositionGrammar } from "./positionGrammar.mjs";
import relationshipGrammar, { RelationshipGrammar } from "./relationshipGrammar.mjs";
import scaleEngine, { ScaleEngine } from "./scaleEngine.mjs";
import realityMemory, { RealityCorrectionMemory } from "./realityCorrection.mjs";
import {
	GenericDomainAdapter,
	HumanDesignDomainAdapter,
	CodeDomainAdapter,
	LanguageDomainAdapter,
} from "./domainAdapters.mjs";
import autoling, { AutoLingAdapter } from "./autolingAdapter.mjs";
import {
	POSITION_ORDER,
	UNDERSTANDING_STEPS,
} from "./constants.mjs";

function freeze(value) {
	return Object.freeze(value);
}

function ensureIdentity(id, spec) {
	const existing = componentRegistry.get(id);
	if (existing?.ready) return existing;
	return componentRegistry.identify({ id, ...spec });
}

function unresolvedPositions(located) {
	return POSITION_ORDER.filter(
		(role) => located.positions[role].status === "unresolved",
	);
}

function composeHypothesis({ located, related, scaled, translated }) {
	const primitive = located.primitive;
	const resolvedPositions = Object.fromEntries(
		POSITION_ORDER
			.filter((role) => located.positions[role].status === "resolved")
			.map((role) => [role, located.positions[role].value]),
	);
	return freeze({
		domain: translated.domain,
		primitive:
			primitive == null
				? null
				: freeze({
					id: primitive.id,
					name: primitive.name,
					meaning: primitive.meaning,
				}),
		positions: freeze(resolvedPositions),
		relationships: related.relations,
		scale: scaled.current.scale,
		scaleName: scaled.current.name,
		unresolved: freeze(unresolvedPositions(located)),
	});
}

export class NativeGrammarRuntime {
	constructor({
		lexicon = new PrimitiveLexicon(),
		positions = new PositionGrammar(),
		relationships = new RelationshipGrammar(),
		scales = new ScaleEngine(),
		memory = new RealityCorrectionMemory(),
		language = new AutoLingAdapter(),
	} = {}) {
		this.id = "synthia-native-grammar";
		this.lexicon = lexicon;
		this.positions = positions;
		this.relationships = relationships;
		this.scales = scales;
		this.memory = memory;
		this.language = language;
		this.domains = new Map();
		this.pending = new Map();
		this.history = [];
		this.registerDomain(new GenericDomainAdapter({ lexicon }));
		this.registerDomain(new HumanDesignDomainAdapter({ lexicon }));
		this.registerDomain(new CodeDomainAdapter({ lexicon }));
		this.registerDomain(new LanguageDomainAdapter({ lexicon }));

		const identity = ensureIdentity(this.id, {
			name: "Synthia Native Grammar",
			kind: "component",
			what: {
				capabilities: [
					"native.understand",
					"native.translate",
					"native.locate",
					"native.relate",
					"native.scale",
					"native.test",
					"native.remember",
					"primitive.lookup",
					"primitive.list",
					"primitive.teach",
					"domain.register",
				],
			},
			why:
				"Provides Synthia's small scale-invariant reasoning grammar: primitive × position × relation × scale × context, corrected by observation.",
			how: {
				pipeline:
					"translate -> locate -> relate -> scale -> test -> remember",
				formula:
					"State = Primitive × Position × Relation × Scale × Context",
			},
			relationships: [
				{ type: "uses", target: "autoling" },
				{ type: "uses", target: "synthia-resonance-relations" },
				{ type: "feeds", target: "synthia-morph-chat" },
				{ type: "feeds", target: "synthia-self-integration" },
			],
			behaviors: [
				"translate-domain-language",
				"locate-semantic-roles",
				"classify-relationships",
				"inspect-cross-scale-structure",
				"test-hypotheses-against-observation",
				"remember-supported-conditional-contradicted-unresolved-results",
			],
			dependencies: [
				"component-registry",
				"ato-core-gate-data",
			],
			when: {
				activation:
					"every addressed cue, explicit reasoning request, or observed outcome",
			},
			provenance: {
				source: "integrated-native-grammar",
				form: "current-working-runtime",
			},
		});
		this.address = identity.address;
		this.capabilities = freeze(identity.what.value.capabilities);

		this.#identifyParts();
	}

	#identifyParts() {
		const parts = [
			{
				id: "synthia-primitive-lexicon",
				name: "Primitive Lexicon",
				capabilities: ["primitive.lookup", "primitive.list", "primitive.teach"],
				why: "Maintains the finite 64-state primitive alphabet used by the native grammar.",
				how: "64 addressed primitive records; unresolved complement information is never invented.",
			},
			{
				id: "synthia-position-grammar",
				name: "Position Grammar",
				capabilities: ["native.locate"],
				why: "Keeps the seven positional jobs stable across changing domain vocabulary.",
				how: "P/D/G/L/C/T/B roles with resolved versus unresolved status.",
			},
			{
				id: "synthia-relationship-grammar",
				name: "Relationship Grammar",
				capabilities: ["native.relate"],
				why: "Classifies same, complementary, and other relations while enforcing local scale contact.",
				how: "resonance / harmony / dissonance plus same-scale and adjacent-scale contact rules.",
			},
			{
				id: "synthia-scale-engine",
				name: "Scale Engine",
				capabilities: ["native.scale"],
				why: "Lets one grammar inspect containing, contributing, counterpart, and composed systems.",
				how: "FOLD / UNFOLD / UP / DOWN / CROSS / PIVOT.",
			},
			{
				id: "synthia-reality-correction",
				name: "Reality Correction Memory",
				capabilities: ["native.test", "native.remember"],
				why: "Keeps generated interpretations hypothetical until observation supplies evidence.",
				how: "predicted versus observed -> supported / conditional / contradicted / unresolved.",
			},
			{
				id: "synthia-autoling-adapter",
				name: "AutoLing Native Grammar Adapter",
				capabilities: ["native.translate"],
				why: "Provides the outside-language boundary without making AutoLing the owner of native reasoning.",
				how: "outside language -> existing AutoLing analysis -> canonical grammar adapter.",
			},
		];

		for (const part of parts) {
			ensureIdentity(part.id, {
				name: part.name,
				kind: "component",
				what: { capabilities: part.capabilities },
				why: part.why,
				how: { mechanism: part.how },
				relationships: [{ type: "contained-by", target: this.id }],
				behaviors: part.capabilities.map((capability) => `provides:${capability}`),
				dependencies:
					part.id === "synthia-primitive-lexicon"
						? ["ato-core-gate-data"]
						: [this.id],
				when: { activation: "native understanding pipeline" },
				provenance: {
					source: "integrated-native-grammar",
					form: "current-working-runtime",
				},
			});
		}
	}

	registerDomain(adapter) {
		if (!adapter?.id || typeof adapter.translate !== "function") {
			throw new TypeError("A native-grammar domain adapter requires id and translate().");
		}
		this.domains.set(String(adapter.id), adapter);
		return adapter;
	}

	setAutoLingInvoker(invoke) {
		this.language.setInvoker(invoke);
		return this;
	}

	domain(id = "generic") {
		return this.domains.get(String(id)) || this.domains.get("generic");
	}

	async translate(input, {
		domain = "generic",
		address = {},
		context = {},
		useAutoLing = false,
	} = {}) {
		const adapter = this.domain(domain);
		const linguistic =
			useAutoLing && typeof input === "string"
				? await this.language.analyze(input)
				: freeze({ status: "skipped", analysis: null });
		const translated = adapter.translate(input, {
			address,
			context: {
				...context,
				domain,
				linguistic:
					linguistic.status === "resolved"
						? linguistic.analysis
						: null,
			},
		});
		return freeze({
			...translated,
			linguistic,
		});
	}

	async understand(input, {
		domain = "generic",
		address = {},
		context = {},
		relations = [],
		scale = 0,
		counterpart = null,
		axis = null,
		branches = [],
		observation = null,
		evidence = [],
		useAutoLing = false,
		remember = true,
	} = {}) {
		const translated = await this.translate(input, {
			domain,
			address,
			context,
			useAutoLing,
		});
		const located = this.positions.locate(translated);
		const related = this.relationships.relate(located, relations);
		const scaled = this.scales.inspect(
			{
				scale,
				located,
				related,
			},
			{
				scale,
				counterpart,
				axis,
				branches,
			},
		);
		const hypothesis = composeHypothesis({
			translated,
			located,
			related,
			scaled,
		});
		const tested = this.memory.test(hypothesis, observation, { evidence });

		const trace = freeze([
			freeze({ step: "translate", value: translated }),
			freeze({ step: "locate", value: located }),
			freeze({ step: "relate", value: related }),
			freeze({ step: "scale", value: scaled }),
			freeze({ step: "test", value: tested }),
		]);
		const result = freeze({
			version: "synthia.native-understanding.v1",
			formula:
				"State = Primitive × Position × Relation × Scale × Context",
			curriculum:
				"Translate -> Locate -> Relate -> Scale -> Test -> Remember",
			domain,
			hypothesis,
			reality: tested,
			trace,
			unresolved: hypothesis.unresolved,
		});

		let remembered = null;
		if (remember) {
			remembered = this.memory.remember({
				domain,
				hypothesis,
				reality: tested,
				context: {
					source: context.source || null,
					cueId: context.cueId || null,
				},
			});
			if (hypothesis.primitive?.id) {
				this.memory.observeAssociation(
					`primitive:${hypothesis.primitive.id}:domain:${domain}`,
					{
						value: {
							positions: hypothesis.positions,
							relations: hypothesis.relationships,
						},
						status: tested.status,
						source: context.source || "native-understanding",
					},
				);
			}
			this.history.unshift(freeze({
				result,
				rememberedAt: remembered.at,
			}));
			this.history.length = Math.min(this.history.length, 128);
		}

		return freeze({
			...result,
			trace: freeze([
				...trace,
				freeze({
					step: "remember",
					value:
						remembered ||
						freeze({ status: "skipped" }),
				}),
			]),
		});
	}

	async observeCue({ cueId, text, address, dimension } = {}) {
		const result = await this.understand(text, {
			domain: "generic",
			address: {
				...address,
				dimension,
			},
			context: {
				cueId,
				source: "living-mesh-cue",
			},
			observation: null,
			useAutoLing: true,
		});
		this.pending.set(String(cueId), result.hypothesis);
		return freeze({
			status: "observed",
			result,
		});
	}

	observeOutcome({ cueId, actorId, output, quality, evidence } = {}) {
		const hypothesis = this.pending.get(String(cueId));
		if (!hypothesis) {
			return freeze({
				status: "unresolved",
				reason: "No pending native-grammar hypothesis for cue.",
			});
		}
		const observed = freeze({
			actorId: actorId || null,
			outputType:
				output == null
					? null
					: Array.isArray(output)
						? "array"
						: typeof output,
			quality: Number.isFinite(Number(quality)) ? Number(quality) : null,
		});
		const tested = this.memory.test(
			{
				actorId: null,
				outputType: null,
				quality: null,
			},
			observed,
			{ evidence: evidence ? [evidence] : [] },
		);
		const record = this.memory.remember({
			domain: hypothesis.domain || "generic",
			hypothesis,
			reality: tested,
			context: {
				cueId,
				actorId,
			},
		});
		this.pending.delete(String(cueId));
		return freeze({
			status: "remembered",
			reality: tested.status,
			recordedAt: record.at,
		});
	}

	async run(input = {}, context = {}) {
		const operation = input?.operation || input?.op || "understand";
		switch (operation) {
			case "understand":
				return this.understand(input.input ?? input.text ?? input, {
					...context,
					...(input.options || {}),
				});
			case "translate":
				return this.translate(input.input ?? input.text ?? input, {
					...context,
					...(input.options || {}),
				});
			case "primitive.lookup":
				return this.lexicon.find(input.value ?? input.id ?? input.text);
			case "primitive.list":
				return this.lexicon.list();
			case "primitive.teach":
				return this.lexicon.teach(input.id, input.patch || {});
			case "scale":
				return this.scales.operate(input.operator, input.state, input.context || {});
			case "snapshot":
				return this.snapshot();
			default:
				throw new RangeError(`Unknown native grammar operation: ${operation}`);
		}
	}

	snapshot() {
		return freeze({
			version: "synthia.native-grammar.v1",
			id: this.id,
			address: this.address,
			capabilities: this.capabilities,
			primitives: this.lexicon.snapshot(),
			domains: freeze([...this.domains.keys()].sort()),
			steps: UNDERSTANDING_STEPS,
			memory: this.memory.snapshot(),
			history: freeze(this.history.slice(0, 32)),
		});
	}
}

export {
	PrimitiveLexicon,
	PositionGrammar,
	RelationshipGrammar,
	ScaleEngine,
	RealityCorrectionMemory,
	AutoLingAdapter,
};

export default new NativeGrammarRuntime({
	lexicon: primitiveLexicon,
	positions: positionGrammar,
	relationships: relationshipGrammar,
	scales: scaleEngine,
	memory: realityMemory,
	language: autoling,
});

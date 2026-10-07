import synthesis, { TOOL_LEVELS } from "./synthesisRuntime.mjs";

import { SynthiaAutomata } from "./semantic-mesh/engine/synthia.js";
import { Automaton as SemanticAutomaton } from "./semantic-mesh/automata/automaton.js";
import {
	Triple,
	toolOntology,
	tripleValueHash,
} from "./semantic-mesh/engine/triples.js";
import {
	PROJECTIONS,
} from "./semantic-mesh/mesh/mesh.js";
import { StatePacket } from "./semantic-mesh/mesh/packet.js";
import { ResonanceNetwork } from "./semantic-mesh/engine/resonance-network.js";
import {
	AnticipatoryMemory,
	publicAddress,
} from "./semantic-mesh/merged/mesh-memory.js";
import { PhaseSpaceEngine } from "./semantic-mesh/engine/v2/phase_space_engine.js";
import {
	DIMENSIONS as SEMANTIC_DIMENSIONS,
	StateSpace as SemanticStateSpace,
} from "./semantic-mesh/state-space/mesh-state-space.js";

const DIMENSION_NAMES = Object.freeze([
	"Movement",
	"Evolution",
	"Being",
	"Design",
	"Space",
]);

const DIMENSION_TO_PROJECTION = Object.freeze(
	Object.fromEntries(
		Object.entries(SEMANTIC_DIMENSIONS).map(([dimension, spec]) => [
			dimension,
			spec.layerRole === "state" ? "phase" : spec.layerRole,
		]),
	),
);

const PRIVATE_CONTEXT_KEYS = new Set([
	"rawText",
	"conversation",
	"document",
	"userId",
	"sessionId",
	"privateCoordinates",
]);

function cleanText(value) {
	return String(value ?? "").trim();
}

function normalizeDimension(value, fallback = "Being") {
	if (DIMENSION_NAMES.includes(value)) return value;
	const normalized = String(value ?? "").trim().toLowerCase();
	const byName = DIMENSION_NAMES.find(
		(dimension) => dimension.toLowerCase() === normalized,
	);
	if (byName) return byName;

	const functional = {
		movement: "Movement",
		evolution: "Evolution",
		being: "Being",
		design: "Design",
		space: "Space",
		mind: "Design",
		body: "Being",
		heart: "Movement",
	};
	return functional[normalized] || fallback;
}

function normalizeGate(value, fallback = 1) {
	const gate = Number(value);
	if (!Number.isFinite(gate)) return fallback;
	return Math.min(64, Math.max(1, Math.trunc(gate)));
}

function normalizeAddress(address = {}, dimension = null) {
	return Object.freeze({
		gate: normalizeGate(address.gate),
		line: Math.min(6, Math.max(1, Math.trunc(Number(address.line) || 1))),
		color: Math.min(6, Math.max(1, Math.trunc(Number(address.color) || 1))),
		tone: Math.min(6, Math.max(1, Math.trunc(Number(address.tone) || 1))),
		base: Math.min(5, Math.max(1, Math.trunc(Number(address.base) || 1))),
		...(address.degree !== undefined ? { degree: Number(address.degree) || 0 } : {}),
		...(address.minute !== undefined ? { minute: Number(address.minute) || 0 } : {}),
		...(address.second !== undefined ? { second: Number(address.second) || 0 } : {}),
		...(address.arcSecond !== undefined ? { arcSecond: Number(address.arcSecond) || 0 } : {}),
		...(address.zodiac !== undefined ? { zodiac: address.zodiac } : {}),
		...(address.house !== undefined ? { house: address.house } : {}),
		planetaryDimension: normalizeDimension(
			address.planetaryDimension || address.dimension || dimension,
		),
	});
}

function nodeId(dimension, gate) {
	return `${dimension}:G${normalizeGate(gate)}`;
}

function semanticVector(address, dimension) {
	const dimensionIndex = Math.max(0, DIMENSION_NAMES.indexOf(dimension));
	return Object.freeze([
		dimensionIndex / Math.max(1, DIMENSION_NAMES.length - 1),
		(address.gate - 1) / 63,
		(address.line - 1) / 5,
		(address.color - 1) / 5,
		(address.tone - 1) / 5,
		(address.base - 1) / 4,
	]);
}

function safeContext(context = {}) {
	const clean = {};
	for (const [key, value] of Object.entries(context || {})) {
		if (PRIVATE_CONTEXT_KEYS.has(key)) continue;
		if (
			value === null ||
			["string", "number", "boolean"].includes(typeof value)
		) {
			clean[key] = value;
		}
	}
	return clean;
}

function capabilitiesOf(source, fallback = []) {
	const declared =
		source?.metadata?.capabilities ||
		source?.capabilities ||
		source?.manifest?.()?.metadata?.capabilities ||
		fallback;
	return [...new Set(Array.from(declared || []).map(String))].sort();
}

function rawToolView(raw) {
	if (!raw) return null;
	return Object.freeze({
		id: raw.id,
		name: raw.name,
		address: Object.freeze({
			gate: raw.plan.gate,
			line: raw.plan.line,
			color: raw.plan.color,
			tone: raw.plan.tone,
			base: raw.plan.base,
		}),
		dimension: raw.plan.dimension,
		level: raw.plan.level,
		levelName: TOOL_LEVELS[raw.plan.level].name,
		execute: (input) => raw.execute(input),
	});
}

/**
 * Adapter used only by the restored semantic-mesh learning path.
 *
 * It intentionally delegates growth to the active Integrated Tool Factory.
 * The Kimi donor's factory remains preserved in its donor source, but newly
 * learned runtime tools are materialized by the same current factory used by
 * Synthia's ATO tool-synthesis capability.
 */
export class IntegratedFactoryGrowthAdapter {
	constructor({ runtime = synthesis } = {}) {
		this.runtime = runtime;
	}

	generate({ purpose, input, dimension } = {}) {
		const text = cleanText(purpose || input);
		if (!text) return Object.freeze({
			status: "unresolved",
			reason: "MISSING_PURPOSE",
		});

		// Prefer the active factory's own routing so an equivalent ATO request
		// resolves to the same stable tool identity. If that router has no match,
		// the semantic node's resolved dimension is used as an explicit fallback.
		let result = this.runtime.synthesize({
			purpose: text,
			input: cleanText(input || text),
		});
		if (!result?.tool && DIMENSION_NAMES.includes(dimension)) {
			result = this.runtime.synthesize({
				purpose: text,
				input: cleanText(input || text),
				dimension,
			});
		}
		if (!result?.tool) return result;

		const raw = this.runtime.factory.tools.get(result.tool.id);
		return Object.freeze({
			status: result.generationStatus || result.status,
			tool: rawToolView(raw),
		});
	}
}

/**
 * LivingMeshRuntime activates the preserved semantic-mesh lineage without
 * making it a controller over other Synthia systems.
 *
 * It provides:
 * - the five distinct graph projections;
 * - all canonical Kimi/Klein tool automatons on one semantic mesh;
 * - semantic triples for tool identity and run provenance;
 * - emergent channels from actual packet crossings;
 * - a relational resonance field;
 * - the five-stage phase-space transformation;
 * - privacy-bounded anticipatory memory;
 * - proxy bindings for independent current ATO nodes.
 *
 * The private binding map is intentionally not serialized into snapshots.
 */
export class LivingMeshRuntime extends EventTarget {
	constructor({
		engine = new SynthiaAutomata(),
		stateSpace = new SemanticStateSpace(),
		phase = new PhaseSpaceEngine(),
		resonance = new ResonanceNetwork(),
		memory = new AnticipatoryMemory(),
		factoryAdapter = new IntegratedFactoryGrowthAdapter(),
	} = {}) {
		super();
		this.engine = engine;
		this.stateSpace = stateSpace;
		this.phase = phase;
		this.resonance = resonance;
		this.memory = memory;
		this.privateBindings = new Map();
		this.signalSubscribers = new Map();
		this.sequence = 0;
		this.history = [];

		// Keep the donor's boot-grown media-field, then make all subsequent
		// runtime growth use the active Integrated Tool Factory.
		this.engine.learning.factory = factoryAdapter;

		this.#seedStructuralProjections();
		for (const automaton of this.engine.mesh.automata.values()) {
			this.#indexAutomaton(automaton, { origin: "kimi-canonical" });
		}
	}

	#seedStructuralProjections() {
		for (const [dimension, layer] of Object.entries(this.stateSpace.dimensions)) {
			const projection = DIMENSION_TO_PROJECTION[dimension];
			if (!PROJECTIONS.includes(projection)) continue;
			const ordered = layer.nodes;
			for (let index = 0; index < ordered.length; index += 1) {
				const current = ordered[index];
				const next = ordered[(index + 1) % ordered.length];
				this.engine.mesh.addEdge(
					projection,
					nodeId(dimension, current.gate),
					nodeId(dimension, next.gate),
					"state-transition-neighbor",
					{
						dimension,
						sequence: layer.sequenceName,
					},
				);
			}
		}
	}

	#indexAutomaton(automaton, { origin = "semantic-mesh" } = {}) {
		const dimension = normalizeDimension(automaton.dimension);
		const gate = normalizeGate(automaton.address?.gate);
		const projection = DIMENSION_TO_PROJECTION[dimension] || "phase";
		const semanticNode = nodeId(dimension, gate);

		if (projection !== "phase") {
			this.engine.mesh.addEdge(
				projection,
				automaton.id,
				semanticNode,
				"occupies-dimensional-position",
				{ origin, dimension, gate },
			);
		}

		// Every executable tool can participate in the Being/phase projection,
		// while still retaining its own dimensional position above.
		this.engine.mesh.addEdge(
			"phase",
			automaton.id,
			nodeId("Being", gate),
			"participates-in-phase-space",
			{ origin, dimension, gate },
		);

		this.resonance.addNode(automaton.id, {
			origin,
			dimension,
			gate,
			capabilities: capabilitiesOf(automaton),
		});
	}

	/**
	 * Bind an independent current ATO node into the semantic mesh by proxy.
	 * The proxy publishes only identity/capabilities/address and delegates calls
	 * through a private binding; the target's owned state never moves into this
	 * mesh.
	 */
	attachATO(
		source,
		{
			id = source?.id,
			dimension = null,
			capabilities = null,
			address = null,
			origin = "current-ato",
		} = {},
	) {
		if (!source || typeof id !== "string" || !id) {
			throw new TypeError("attachATO requires an addressable source node.");
		}

		const sourceAddress = normalizeAddress(
			address || source.address || {},
			dimension || source.functionalLevel,
		);
		const resolvedDimension = normalizeDimension(
			dimension ||
			sourceAddress.planetaryDimension ||
			source.functionalLevel,
		);
		const declaredCapabilities = capabilities
			? [...new Set(capabilities.map(String))]
			: capabilitiesOf(source);

		this.privateBindings.set(id, source);
		if (
			typeof source.observeCue === "function" ||
			typeof source.observeOutcome === "function"
		) {
			this.signalSubscribers.set(id, source);
		}

		const existing = this.engine.mesh.get(id);
		if (existing) {
			this.engine.tripleStore.add(new Triple({
				subject: id,
				predicate: "boundToCurrentImplementation",
				object: origin,
				provenance: "living-mesh-binding",
			}));
			return existing;
		}

		const proxy = new SemanticAutomaton({
			id,
			address: {
				...sourceAddress,
				planetaryDimension: resolvedDimension,
			},
			states: [
				{ id: "ready", initial: true, accepting: true },
			],
			capabilities: declaredCapabilities,
			dimension: resolvedDimension,
			automatonForm: "external-node-proxy",
			implementation: async (input, { context }) => {
				const target = this.privateBindings.get(id);
				if (!target) throw new Error(`Binding unavailable for ${id}`);
				if (typeof target.call === "function") {
					return target.call(input, context);
				}
				if (typeof target.process === "function") {
					return target.process(input, context);
				}
				if (typeof target.run === "function") {
					return target.run(input, context);
				}
				throw new Error(`Bound node ${id} has no callable interface.`);
			},
		});

		this.engine.mesh.register(proxy);
		this.engine.tripleStore.addAll(toolOntology(proxy));
		this.engine.tripleStore.add(new Triple({
			subject: id,
			predicate: "boundToCurrentImplementation",
			object: origin,
			provenance: "living-mesh-binding",
		}));
		this.#indexAutomaton(proxy, { origin });
		return proxy;
	}

	/**
	 * Invoke one semantic node. When the same logical node has a verified
	 * current-ATO implementation bound privately, that implementation is used
	 * without duplicating the node id on the shared mesh. Callers may request
	 * the preserved semantic implementation explicitly for lineage comparison.
	 */
	async invoke(id, input, {
		context = {},
		implementation = "current",
	} = {}) {
		const current = this.privateBindings.get(id);
		if (implementation !== "semantic" && current) {
			if (typeof current.call === "function") return current.call(input, context);
			if (typeof current.process === "function") return current.process(input, context);
			if (typeof current.run === "function") return current.run(input, context);
		}

		const semantic = this.engine.mesh.get(id);
		if (!semantic || typeof semantic.run !== "function") {
			throw new Error(`No callable semantic node: ${id}`);
		}
		const run = semantic.run(input, context);
		return Promise.resolve(run.output);
	}

	/**
	 * Record a real information crossing and optionally execute the destination.
	 * Repeated crossings are what promote Kimi's emergent channels.
	 */
	async transmit({
		from,
		to,
		payload,
		address = null,
		kind = "data",
		execute = false,
		context = {},
	} = {}) {
		const packet = new StatePacket({
			id: `live-packet-${++this.sequence}`,
			from,
			to,
			kind,
			payload,
			address: address ? publicAddress(address) : null,
			derivationId: null,
		});
		const receipt = this.engine.mesh.route(packet);

		let output = null;
		if (execute && receipt.delivered) {
			output = await this.invoke(to, {
				packet,
				payload,
				raw: typeof payload === "string" ? payload : null,
				args: [payload],
			}, { context });
		}

		this.resonance.observe({
			a: from,
			b: to,
			outcome: receipt.delivered ? 1 : -1,
			type: "mesh-crossing",
			evidence: packet.id,
			verified: true,
		});

		return Object.freeze({
			packetId: packet.id,
			receipt,
			output,
			channel: this.engine.channelCapability(from, to),
		});
	}

	/**
	 * Process a cue through the preserved semantic-tool population.
	 *
	 * The Kimi intake address remains explicitly a local "hash-candidate".
	 * The caller-supplied canonical address is recorded separately and used for
	 * public mesh memory / phase placement so the candidate cannot silently
	 * become a second global address authority.
	 */
	async processCue(text, {
		address = {},
		context = {},
		runTools = true,
	} = {}) {
		const cue = cleanText(text);
		if (!cue) throw new TypeError("LivingMeshRuntime requires a cue.");

		const canonical = normalizeAddress(address);
		const dimension = normalizeDimension(
			address.dimension || canonical.planetaryDimension,
		);
		const cueId = `living-cue-${++this.sequence}`;
		const canonicalStateId = nodeId(dimension, canonical.gate);

		this.engine.tripleStore.addAll([
			new Triple({
				subject: cueId,
				predicate: "hasCanonicalPublicAddress",
				object: `G${canonical.gate}.L${canonical.line}.C${canonical.color}.T${canonical.tone}.B${canonical.base}`,
				provenance: "living-mesh-cue",
			}),
			new Triple({
				subject: cueId,
				predicate: "occupiesDimension",
				object: dimension,
				provenance: "living-mesh-cue",
			}),
			new Triple({
				subject: cueId,
				predicate: "occupiesState",
				object: canonicalStateId,
				provenance: "living-mesh-cue",
			}),
		]);

		const phase = this.phase.compose({
			id: cueId,
			vector: semanticVector(canonical, dimension),
			address: publicAddress(canonical),
		}, {
			mesh: this.engine.mesh,
			history: this.history.slice(-10).map((entry) => entry.phase?.finalState),
			rules: [],
		});

		for (const stage of phase.trace) {
			const stageProjection =
				DIMENSION_TO_PROJECTION[stage.stage] || "phase";
			this.engine.mesh.addEdge(
				stageProjection,
				cueId,
				nodeId(stage.stage, canonical.gate),
				"cue-stage-transition",
				{
					stage: stage.stage,
					sequence: this.sequence,
				},
			);
		}

		const precedent = this.memory.observe(canonical, {
			cueId,
			kind: "cue",
			dimension,
			phaseComplete: phase.complete,
			confidence: 0.5,
			// raw cue intentionally omitted at the public-memory boundary
		});

		let semantic = null;
		if (runTools) {
			semantic = await this.engine.request(cue, {
				...safeContext(context),
				canonicalPublicAddress: publicAddress(canonical),
				canonicalDimension: dimension,
			});

			if (semantic?.intakeId) {
				this.engine.tripleStore.add(new Triple({
					subject: semantic.intakeId,
					predicate: "candidateAddressProjectsTo",
					object: `G${canonical.gate}.L${canonical.line}.C${canonical.color}.T${canonical.tone}.B${canonical.base}`,
					provenance: "canonical-address-bridge",
				}));
			}
		}

		const reactions = {};
		for (const [subscriberId, subscriber] of this.signalSubscribers) {
			if (typeof subscriber.observeCue !== "function") continue;
			try {
				reactions[subscriberId] = await subscriber.observeCue({
					cueId,
					text: cue,
					address: canonical,
					dimension,
					semantic,
				});
			} catch (error) {
				reactions[subscriberId] = Object.freeze({
					status: "error",
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}

		const record = Object.freeze({
			id: cueId,
			dimension,
			address: publicAddress(canonical),
			phase,
			semantic,
			reactions: Object.freeze(reactions),
			precedentId: precedent.precedentId,
		});
		this.history.unshift(record);
		this.history.length = Math.min(this.history.length, 128);
		this.dispatchEvent(new CustomEvent("cue", { detail: record }));
		return record;
	}

	/**
	 * Feed an observed outcome back into semantic provenance and resonance.
	 */
	observeOutcome({
		cueId,
		nodeId: actorId,
		output,
		quality = 0,
		address = {},
	} = {}) {
		if (!cueId || !actorId) return null;
		const outcomeId = `outcome:${tripleValueHash(output)}`;
		this.engine.tripleStore.addAll([
			new Triple({
				subject: cueId,
				predicate: "resolvedBy",
				object: actorId,
				provenance: "living-mesh-outcome",
			}),
			new Triple({
				subject: actorId,
				predicate: "produced",
				object: outcomeId,
				provenance: "living-mesh-outcome",
			}),
		]);
		const resonance = this.resonance.observe({
			a: cueId,
			b: actorId,
			outcome: quality,
			type: "execution-outcome",
			evidence: outcomeId,
			verified: true,
		});
		const precedent = this.memory.observe(address, {
			cueId,
			actorId,
			outcomeId,
			quality,
			evidenceCount: 1,
			confidence: Math.max(0, Math.min(1, (Number(quality) + 1) / 2)),
		});
		const reactions = {};
		for (const [subscriberId, subscriber] of this.signalSubscribers) {
			if (typeof subscriber.observeOutcome !== "function") continue;
			try {
				const reaction = subscriber.observeOutcome({
					cueId,
					actorId,
					output,
					quality,
					address,
					evidence: outcomeId,
				});
				reactions[subscriberId] =
					reaction && typeof reaction.then === "function"
						? Object.freeze({ status: "async-observer-not-awaited" })
						: reaction;
			} catch (error) {
				reactions[subscriberId] = Object.freeze({
					status: "error",
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return Object.freeze({
			outcomeId,
			resonance,
			precedent,
			reactions: Object.freeze(reactions),
		});
	}

	capabilities() {
		return Object.freeze(
			[...this.engine.mesh.automata.values()]
				.map((automaton) => Object.freeze({
					id: automaton.id,
					dimension: automaton.dimension || null,
					gate: automaton.address?.gate || null,
					capabilities: Object.freeze(capabilitiesOf(automaton)),
					proxy: automaton.automatonForm === "external-node-proxy",
				}))
				.sort((a, b) => a.id.localeCompare(b.id)),
		);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.living-mesh.v1",
			automata: this.engine.mesh.automata.size,
			canonicalToolCount: this.engine.listTools().length,
			grownTools: Object.freeze(this.engine.grownTools()),
			capabilities: this.capabilities(),
			mesh: this.engine.mesh.snapshot(),
			metrics: this.engine.meshMetrics(),
			emergentChannels: Object.freeze(this.engine.emergentChannels()),
			tripleCount: this.engine.tripleStore.size(),
			resonance: this.resonance.snapshot(),
			publicMemory: this.memory.snapshot(),
			phase: Object.freeze({
				stageOrder: Object.freeze([...this.phase.stageOrder]),
				tick: this.phase.tick,
			}),
			history: Object.freeze(this.history.slice(0, 32)),
			// privateBindings intentionally omitted
		});
	}
}

export {
	DIMENSION_NAMES,
	DIMENSION_TO_PROJECTION,
	PROJECTIONS,
};

export default new LivingMeshRuntime();

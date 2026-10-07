
import { canonicalAddress } from "./ato-core/address-space.mjs";
import canonicalState from "./canonicalState.mjs";
import livingMesh from "./livingMeshRuntime.mjs";
import morphChat from "./morph-chat/runtime.mjs";
import morphChange from "./morph-engine/changeRuntime.mjs";
import morphSubstrate from "./morph-engine/substrateRuntime.mjs";
import componentRegistry from "./identity/componentRegistry.mjs";
import { SelfIntegrationRuntime } from "./assembly/selfIntegrationRuntime.mjs";
import coreCapabilities from "./coreCapabilityRuntime.mjs";
import grammarSystems from "./grammarSystemsRuntime.mjs";
import connectionField from "./neural/connectionField.mjs";
import humanDesignGNN from "./neural/humanDesignGNN.mjs";
import neuralArchitecture from "./neural/architectureModulation.mjs";
import generativeChannels from "./neural/generativeChannelField.mjs";
import nativeGrammar from "./native-grammar/runtime.mjs";
import embodiment from "./embodiment/embodimentRuntime.mjs";
import remoteCapabilities from "./remote/RemoteCapabilityRuntime.mjs";
import livingOrganism from "./organism/livingOrganismRuntime.mjs";
import {
	GenerativeExperimentOrchestrator,
	generativeExperimentOrchestratorAutomaton,
} from "./orchestrator/runtime.mjs";

function pathFor(result) {
	const path = ["recognizer"];
	if (result.structural?.grammar?.ruleCount) path.push("deg");
	if (result.structural?.geometry?.nodeCount) path.push("geo-deg");
	path.push("micro-state-space", "composition-predictor", "puct", "task-assignment");
	if (result.executions.length) path.push("execute");
	path.push("score", "learn");
	return Object.freeze(path);
}

function summaryFor(result) {
	const selected = result.selected.candidate;
	if (selected.kind === "tool-synthesis") {
		const built = result.executions.find((item) => item.capability === "tool.synthesize");
		const tool = built?.output?.tool;
		return tool
			? `Built ${tool.name} through the searched execution stack.`
			: "The build path was searched, assigned, and executed.";
	}
	if (result.structural?.grammar?.ruleCount) {
		return `Resolved through ${result.structural.grammar.ruleCount} learned grammar rules; selected ${selected.id}.`;
	}
	return `Resolved through ${selected.id} with ${result.exploration.strategy} search.`;
}

function capabilitiesOf(source) {
	const declared =
		source?.metadata?.capabilities ||
		source?.capabilities ||
		source?.manifest?.()?.metadata?.capabilities ||
		[];
	return Object.freeze([...new Set(Array.from(declared || []).map(String))]);
}

function identifyRuntimeNode(source, {
	id = source?.id,
	name = id,
	kind = "agent",
	dimension = null,
	origin = "integrated-runtime",
	purpose = "Provides a live addressed capability in Synthia.",
	relationships = [],
	behaviors = [],
	dependencies = [],
	when = { activation: "capability or mesh condition" },
	transition = null,
} = {}) {
	const capabilities = capabilitiesOf(source);
	const existing = componentRegistry.get(id);
	if (existing?.ready) return existing;
	return componentRegistry.identify({
		id,
		name,
		kind,
		address: source?.address || (
			dimension ? { dimension } : null
		),
		what: {
			capabilities,
			interface:
				typeof source?.run === "function"
					? "run"
					: typeof source?.process === "function"
						? "process"
						: typeof source?.call === "function"
							? "call"
							: "passive",
		},
		why: purpose,
		how: {
			mechanism: "addressed mesh capability",
		},
		relationships,
		behaviors:
			behaviors.length
				? behaviors
				: capabilities.map((capability) => `provides:${capability}`),
		dependencies,
		when,
		provenance: {
			source: origin,
			form: "integrated-working-runtime",
		},
		transition,
	});
}

export class SynthiaRuntime extends EventTarget {
	constructor({
		orchestrator = new GenerativeExperimentOrchestrator({
			kernel: canonicalState.kernel,
		}),
		meshRuntime = livingMesh,
	} = {}) {
		super();
		this.orchestrator = orchestrator;
		this.meshRuntime = meshRuntime;
		this.orchestrator.attachToolMesh(grammarSystems.mesh);
		this.orchestrator.attachToolMesh(coreCapabilities.mesh);
		this.automaton = generativeExperimentOrchestratorAutomaton({
			runtime: this.orchestrator,
		});
		this.selfIntegration = new SelfIntegrationRuntime({
			meshRuntime: this.meshRuntime,
			changeRuntime: morphChange,
		});
		remoteCapabilities.connectTransitionResolver(this.selfIntegration.transitionResolver);
		remoteCapabilities.boot();
		nativeGrammar.setAutoLingInvoker((id, input, invokeOptions = {}) =>
			this.meshRuntime.invoke(id, input, invokeOptions),
		);

		const mount = (source, options = {}) => {
			const identity = identifyRuntimeNode(source, options);
			const capabilities = capabilitiesOf(source);
			this.meshRuntime.attachATO(source, {
				id: identity.id,
				dimension:
					options.dimension ||
					identity.address.dimension ||
					identity.address.planetaryDimension,
				capabilities,
				address: identity.address,
				origin: options.origin || "integrated-runtime",
			});
			this.selfIntegration.registerIdentity(identity, { capabilities });
			return identity;
		};

		mount(grammarSystems.deg, {
			name: "DEG Grammar Learner",
			dimension: "Evolution",
			origin: "current-deg",
			purpose: "Learns reusable structural grammar and generates from learned rules.",
			dependencies: [],
		});
		mount(grammarSystems.geoDeg, {
			name: "Geo-DEG Grammar Geometry",
			dimension: "Space",
			origin: "current-geo-deg",
			purpose: "Organizes learned grammar into relational geometry for neighborhood, route, and composition operations.",
			dependencies: ["deg"],
		});
		mount(coreCapabilities.toolSynthesis, {
			name: "Integrated Tool Factory",
			dimension: "Being",
			origin: "current-integrated-tool-factory",
			purpose: "Synthesizes and mounts executable addressed tools when a capability is needed.",
			transition: {
				accepts: ["addressed", "capability-required"],
				produces: ["executable"],
				solves: ["addressed-but-not-executable"],
				triggers: ["implementation-missing"],
			},
		});
		mount(this.automaton, {
			name: "Generative Experiment Automaton",
			dimension: "Evolution",
			origin: "current-experiment-node",
			purpose: "Runs its own experiment/search cycle without governing other Automatons.",
			dependencies: ["deg", "geo-deg"],
		});
		mount(livingOrganism, {
			name: "Cynthia Living Organism Pulse",
			dimension: "Being",
			origin: "organism-20-governed-integration",
			purpose: "Provides bounded organism pulses, metabolism, episodic memory, action deduplication, and a non-overwritable approval gate.",
			dependencies: ["synthia-self-integration"],
			transition: {
				accepts: ["action-proposed", "elapsed-time", "observation"],
				produces: ["approval-required", "active-action", "organism-memory"],
				solves: ["unbounded-frame-cognition", "approval-overwrite", "duplicate-action"],
				triggers: ["organism-pulse", "action-request", "verified-outcome"],
			},
		});
		mount(morphChat.chatAutomaton, {
			name: "Morph Chat",
			dimension: "Being",
			origin: "current-morph-chat",
			purpose: "Carries conversation through Morph state, memory, and capability relationships.",
		});
		mount(connectionField, {
			name: "Neural Connection Field",
			dimension: "Being",
			origin: "integrated-perspective-connection-field",
			purpose: "Propagates activity across the compact shared connection field.",
		});
		mount(generativeChannels, {
			name: "Generative Channel Field",
			dimension: "Being",
			origin: "integrated-generative-channel-field",
			purpose: "Tracks generative gate/channel activation and emergent junctions.",
		});
		mount(humanDesignGNN, {
			name: "Human Design GraphSAGE",
			dimension: "Evolution",
			origin: "trained-human-design-gnn",
			purpose: "Performs the integrated 64-gate / 36-channel neural message-passing inference.",
		});
		mount(neuralArchitecture, {
			name: "Neural Architecture Modulator",
			dimension: "Design",
			origin: "neural-architecture-generator",
			purpose: "Modulates capability activation without owning or removing capabilities.",
		});
		mount(morphChange, {
			name: "Morph Change Runtime",
			dimension: "Design",
			origin: "morph-v0.3-integrated",
			purpose: "Provides AST rewriting, sandbox verification, suggestion inbox, and controlled application.",
			transition: {
				accepts: ["change-required", "addressed"],
				produces: ["sandboxed-candidate"],
				solves: ["source-change-not-yet-materialized"],
				triggers: ["wiring-gap", "improvement-candidate"],
			},
		});
		mount(morphSubstrate, {
			name: "Synthia Morph Substrate v0.6",
			dimension: "Design",
			origin: "synthia-morph-engine-v0.6-personal-vault",
			purpose: "Preserves originals, diagnoses artifact graphs, infers missing interfaces, builds bridge candidates, and exposes governed workboard copies.",
			dependencies: ["synthia-morph-change", "synthia-self-integration"],
			transition: {
				accepts: ["artifact-received", "relationship-gap", "interface-gap"],
				produces: ["preserved-original", "bridge-candidate", "workboard-copy"],
				solves: ["artifact-not-preserved", "components-not-connected"],
				triggers: ["file-intake", "missing-interface", "build-request"],
			},
		});
		mount(this.selfIntegration, {
			name: "Synthia Self Integration",
			dimension: "Space",
			origin: "integrated-self-assembly",
			purpose: "Detects relationship gaps and coordinates Synthia's own verified wiring workflow.",
			transition: {
				accepts: ["addressed", "relationship-gap"],
				produces: ["wiring-plan"],
				solves: ["addressed-but-not-connected"],
				triggers: ["missing-relationship"],
			},
		});
		mount(this.selfIntegration.transitionResolver, {
			name: "Transition Resolver",
			dimension: "Evolution",
			origin: "canonical-transition-resolution",
			purpose: "Resolves current-to-desired state gaps backward through addressed capability transitions.",
			dependencies: ["component-registry", "synthia-self-integration"],
			transition: {
				accepts: ["current-state", "desired-state"],
				produces: ["transition-plan"],
				solves: ["known-state-gap"],
				triggers: ["state-gap-observed"],
			},
		});
		mount(this.selfIntegration.resonance, {
			name: "Resonance Relations",
			dimension: "Evolution",
			origin: "integrated-resonance-network",
			purpose: "Connects addressed people, places, things, agents, tools, and artifacts through observed relational resonance.",
		});
		mount(nativeGrammar, {
			name: "Synthia Native Grammar",
			origin: "integrated-native-grammar",
			purpose: "Applies the shared primitive-position-relation-scale-context grammar and corrects hypotheses through observation.",
			dependencies: ["autoling", "synthia-resonance-relations"],
		});
		mount(embodiment, {
			name: "Synthia Embodiment",
			dimension: "Being",
			origin: "sovereign-capability-body",
			purpose: "Separates permanent mind/heart capacities from the 26 active action-tool slots and requires component agreement before effects.",
			transition: {
				accepts: ["addressed-task", "host-capability"],
				produces: ["agreed-effect-or-decline"],
				solves: ["capability-does-not-imply-participation"],
				triggers: ["physical-or-host-action-requested"],
			},
		});
		mount(remoteCapabilities, {
			name: "Addressed Remote Capability Runtime",
			dimension: "Space",
			origin: "addressed-remote-capability-runtime",
			purpose: "Keeps the body small by resolving, verifying, inviting, and temporarily activating addressed remote capabilities.",
			dependencies: ["synthia-embodiment", "synthia-morph-substrate"],
			transition: {
				accepts: ["capability-required", "remote-address-known"],
				produces: ["verified-invited-capability"],
				solves: ["capability-not-resident"],
				triggers: ["address-or-transition-match"],
			},
		});

		for (const klein of morphChat.klein.values()) {
			mount(klein, {
				name: klein.name || klein.id,
				origin: "current-ato-klein",
				purpose: "Provides an independent Klein capability on the shared mesh.",
			});
		}

		// Identify the semantic-mesh tools that boot inside LivingMeshRuntime.
		for (const node of this.meshRuntime.capabilities()) {
			if (componentRegistry.has(node.id)) continue;
			const identity = componentRegistry.identify({
				id: node.id,
				name: node.id,
				kind: "tool",
				address: {
					gate: node.gate || 1,
					dimension: node.dimension || "Being",
				},
				what: { capabilities: [...node.capabilities] },
				why: "Participates as an executable semantic/Klein capability in the shared Living Mesh.",
				how: { mechanism: "semantic automaton" },
				relationships: [],
				behaviors: node.capabilities.map((capability) => `provides:${capability}`),
				dependencies: [],
				when: { activation: "semantic or capability match" },
				provenance: {
					source: node.proxy ? "current-integrated-proxy" : "integrated-semantic-mesh",
				},
			});
			this.selfIntegration.registerIdentity(identity, {
				capabilities: node.capabilities,
			});
		}

		// Register every identified internal component so WHO/WHAT/WHERE/WHY
		// records can participate in the same relationship field without
		// exposing private implementation state.
		for (const identity of componentRegistry.list({ ready: true })) {
			if (this.selfIntegration.assetGraph.nodes.has(identity.id)) continue;
			this.selfIntegration.registerIdentity(identity, {
				capabilities: identity.what.value.capabilities || [],
			});
		}

		this.neural = Object.freeze({
			connectionField,
			generativeChannels,
			humanDesignGNN,
			neuralArchitecture,
		});
		this.activity = [];
	}

	async talk(input, options = {}) {
		const text = String(input || "").trim();
		if (!text) throw new TypeError("Synthia needs a message.");

		const runtime = await this.process(text, {
			...options,
			surface: options.surface || "conversation",
		});
		const conversation = await morphChat.send(text);
		const response = Object.freeze({
			text: conversation.assistant.text,
			assistant: conversation.assistant,
			conversation,
			runtime,
		});

		this.activity.unshift(Object.freeze({
			type: "conversation",
			response,
			at: new Date().toISOString(),
		}));
		this.activity.length = Math.min(this.activity.length, 100);
		this.dispatchEvent(new CustomEvent("conversation", { detail: response }));
		return response;
	}
	async process(input, options = {}) {
		const text = String(input || "").trim();
		if (!text) throw new TypeError("Synthia needs input to process.");

		const projected = canonicalState.resolve(text);
		const mesh = await this.meshRuntime.processCue(text, {
			address: projected,
			context: {
				surface: options.surface || "synthia",
			},
		});

		const result = await this.orchestrator.runGoal({
			goal: text,
			...options,
		});

		this.meshRuntime.observeOutcome({
			cueId: mesh.id,
			nodeId: this.automaton.id,
			output: {
				selected: result.selected?.candidate?.id || null,
				executions: result.executions?.length || 0,
				accepted: result.score?.accepted ?? null,
			},
			quality: result.score?.quality ?? 0,
			address: projected,
		});

		const native = mesh.reactions?.[nativeGrammar.id]?.result || null;
		const response = Object.freeze({
			result,
			mesh,
			native,
			address: projected,
			addressText: canonicalState.format(projected),
			addressKey:
				result.recognition.addressKey ||
				(result.address ? canonicalAddress(result.address) : null),
			path: Object.freeze(["semantic-mesh", ...pathFor(result)]),
			summary: summaryFor(result),
		});
		this.activity.unshift(Object.freeze({
			type: "processed",
			response,
			at: new Date().toISOString(),
		}));
		this.activity.length = Math.min(this.activity.length, 100);
		this.dispatchEvent(new CustomEvent("activity", { detail: response }));
		return response;
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.runtime.v4",
			canonical: true,
			livingMesh: this.meshRuntime.snapshot(),
			organism: livingOrganism.snapshot(),
			identity: componentRegistry.snapshot(),
			selfIntegration: this.selfIntegration.snapshot(),
			morphSubstrate: morphSubstrate.snapshot(),
			embodiment: embodiment.snapshot(),
			remoteCapabilities: remoteCapabilities.snapshot(),
			transitionResolver: this.selfIntegration.transitionResolver.snapshot(),
			nativeGrammar: nativeGrammar.snapshot(),
			neural: Object.freeze({
				connectionField: connectionField.snapshot(),
				generativeChannels: generativeChannels.snapshot(),
				humanDesignGNN: humanDesignGNN.snapshot(),
				neuralArchitecture: neuralArchitecture.snapshot(),
			}),
			orchestrator: this.orchestrator.snapshot(),
			state: canonicalState.snapshot(),
			activity: Object.freeze([...this.activity]),
		});
	}
}

export { componentRegistry, embodiment, morphChange, morphSubstrate, remoteCapabilities };
export default new SynthiaRuntime();

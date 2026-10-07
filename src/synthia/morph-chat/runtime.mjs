import {
	AutomataMesh,
	Automaton,
} from "../ato-core/automaton.mjs";
import {
	StateSpaceKernel,
} from "../ato-core/state-space-kernel.mjs";
import {
	TraceFiringRegistry,
} from "../ato-core/trace-firing.mjs";
import {
	bootstrapKleinTools,
} from "../ato-core/klein-tools.mjs";
import {
	computationalGrammarCoderAutomaton,
} from "../ato-core/computational-grammar-coder.mjs";
import { semanticRead } from "./semanticMesh.mjs";
import { ProportionOfPerspective } from "./perspectives.mjs";
import { LocalMorphProvider } from "./providers.mjs";
import { OptionalMeshTools } from "./optionalMeshTools.mjs";

export const CHAT_PHASES = Object.freeze([
	"IDLE",
	"RECEIVE",
	"PARSE",
	"ACTIVATE_MESH",
	"RESOLVE_MEANING",
	"FORM_RESPONSE_INTENT",
	"REALIZE_LANGUAGE",
	"EMIT",
	"LEARN",
	"IDLE",
]);

function now() {
	return new Date().toISOString();
}

function freezeMessage(message) {
	return Object.freeze({ ...message });
}

function traceCueFromState(text, semantic, kernel) {
	const candidate = kernel.describe(text).candidates[0]?.state?.address || {
		mode: "macro",
		gate: 1,
		line: 1,
		color: 1,
		tone: 1,
		base: 1,
	};
	const dimension = ["Movement", "Evolution", "Being", "Design", "Space"]
		.indexOf(semantic.dimension);
	return Object.freeze({
		text,
		intent: semantic.intent,
		dimension: Math.max(0, dimension),
		gate: candidate.gate - 1,
		line: candidate.line - 1,
		color: candidate.color - 1,
		tone: candidate.tone - 1,
		base: candidate.base - 1,
	});
}

function createMorphChatAutomaton({ perspective, coder, klein, optionalTools }) {
	return new Automaton({
		id: "morph-chat",
		address: { mode: "macro", gate: 49, line: 1, color: 1, tone: 1, base: 1 },
		structure: "hexagram",
		activeLevels: [1, 2, 3, 4, 5],
		functionalLevel: "mind",
		ports: [
			{ id: "cue", direction: "input", type: "morph-chat-cue", schemaVersion: "1" },
			{ id: "intent", direction: "output", type: "morph-response-intent", schemaVersion: "1" },
		],
		metadata: {
			family: "morph-chat",
			independent: true,
			role: "conversation-interface",
			meaningOwnsWording: false,
		},
		implementation: async (cue, { context }) => {
			const semantic = semanticRead(cue.text);
			const history = context?.history || [];
			const perspectiveResult = await perspective.read({
				text: cue.text,
				semantic,
				history,
			});
			const autoLing = klein.get("autoling");
			const diseminer = klein.get("diseminer");
			const linguistic = autoLing
				? await autoLing.call(cue.text)
				: null;
			const concepts = diseminer
				? await diseminer.call(cue.text)
				: null;
			const codeAnalysis = semantic.intent === "code"
				? await coder.call({ text: cue.text })
				: null;
			const meshTools = await optionalTools.run(cue.text);
			return Object.freeze({
				semantic,
				perspective: perspectiveResult,
				linguistic,
				concepts,
				codeAnalysis,
				meshTools,
				responseIntent: Object.freeze({
					focus: semantic.focus,
					intent: semantic.intent,
					dimension: semantic.dimension,
					requiresCode: semantic.intent === "code",
				}),
			});
		},
	});
}

/**
 * MorphChatRuntime is the conversational port into the mesh.
 *
 * It coordinates independent automatons, stores session conversation state,
 * and delegates final wording to a replaceable provider.
 */
export class MorphChatRuntime extends EventTarget {
	constructor({
		mesh = new AutomataMesh(),
		kernel = new StateSpaceKernel(),
		provider = new LocalMorphProvider(),
		maxMessages = 120,
		toolMeshes = [],
	} = {}) {
		super();
		this.mesh = mesh;
		this.kernel = kernel;
		this.provider = provider;
		this.maxMessages = maxMessages;
		this.messages = [];
		this.phase = "IDLE";
		this.turn = 0;
		this.last = null;
		this.optionalTools = new OptionalMeshTools({
			meshes: [mesh, ...toolMeshes],
		});

		this.perspective = new ProportionOfPerspective({ mesh });
		const kleinTools = bootstrapKleinTools(mesh);
		this.klein = new Map(kleinTools.map((tool) => [tool.id, tool]));
		this.coder = computationalGrammarCoderAutomaton();
		if (!mesh.automatons.has(this.coder.id)) mesh.add(this.coder);
		else this.coder = mesh.automatons.get(this.coder.id);

		this.chatAutomaton = createMorphChatAutomaton({
			perspective: this.perspective,
			coder: this.coder,
			klein: this.klein,
			optionalTools: this.optionalTools,
		});
		if (!mesh.automatons.has(this.chatAutomaton.id)) mesh.add(this.chatAutomaton);
		else this.chatAutomaton = mesh.automatons.get(this.chatAutomaton.id);

		this.trace = new TraceFiringRegistry({ mesh });
	}

	attachToolMesh(mesh) {
		this.optionalTools.attach(mesh);
		return this;
	}

	detachToolMesh(mesh) {
		this.optionalTools.detach(mesh);
		return this;
	}

	setProvider(provider) {
		if (!provider || typeof provider.generate !== "function") {
			throw new TypeError("Morph Chat provider must expose generate(context).");
		}
		this.provider = provider;
		return this;
	}

	setPhase(phase) {
		this.phase = phase;
		this.dispatchEvent(new CustomEvent("phase", { detail: phase }));
	}

	push(role, text, meta = {}) {
		const message = freezeMessage({
			id: `morph-${++this.turn}-${role}`,
			role,
			text: String(text),
			at: now(),
			...meta,
		});
		this.messages.push(message);
		if (this.messages.length > this.maxMessages) {
			this.messages.splice(0, this.messages.length - this.maxMessages);
		}
		return message;
	}

	async send(input) {
		const text = String(input || "").trim();
		if (!text) throw new TypeError("Morph Chat needs a message.");

		this.setPhase("RECEIVE");
		const user = this.push("user", text);
		this.setPhase("PARSE");
		const semantic = semanticRead(text);
		const cue = traceCueFromState(text, semantic, this.kernel);

		this.setPhase("ACTIVATE_MESH");
		const learned = this.trace.learn(cue, this.chatAutomaton.id);
		const fired = await this.trace.fire(cue, {
			context: Object.freeze({
				history: Object.freeze([...this.messages]),
			}),
		});
		if (!fired.activated || !fired.circuitResult) {
			throw new Error("Morph Chat trace did not activate its bound automaton.");
		}

		this.setPhase("RESOLVE_MEANING");
		const material = fired.circuitResult;
		this.setPhase("FORM_RESPONSE_INTENT");

		const providerContext = Object.freeze({
			text,
			semantic: material.semantic,
			perspective: material.perspective,
			codeAnalysis: material.codeAnalysis,
			linguistic: material.linguistic,
			concepts: material.concepts,
			meshTools: material.meshTools,
			trace: fired,
			history: Object.freeze([...this.messages]),
		});

		this.setPhase("REALIZE_LANGUAGE");
		let response;
		let providerId = this.provider.id || "custom";
		let fallback = false;
		try {
			response = await this.provider.generate(providerContext);
		} catch (error) {
			if (this.provider instanceof LocalMorphProvider) throw error;
			fallback = true;
			providerId = "local-morph";
			response = await new LocalMorphProvider().generate(providerContext);
		}

		this.setPhase("EMIT");
		const assistant = this.push("assistant", response, {
			provider: providerId,
			trace: fired.trace,
			fallback,
		});

		this.setPhase("LEARN");
		this.last = Object.freeze({
			user,
			assistant,
			trace: Object.freeze({
				id: fired.trace,
				bound: learned.automatonId,
				activated: fired.activated,
				completion: fired.completion,
			}),
			semantic: material.semantic,
			perspective: material.perspective,
			codeAnalysis: material.codeAnalysis,
			meshTools: material.meshTools,
			provider: providerId,
			fallback,
		});
		this.setPhase("IDLE");
		this.dispatchEvent(new CustomEvent("message", { detail: this.last }));
		return this.last;
	}

	clear() {
		this.messages.length = 0;
		this.last = null;
		this.phase = "IDLE";
		this.dispatchEvent(new CustomEvent("clear"));
	}

	snapshot() {
		return Object.freeze({
			phase: this.phase,
			messages: Object.freeze([...this.messages]),
			last: this.last,
			trace: this.trace.snapshot(),
			mesh: this.mesh.snapshot(),
			kleinTools: Object.freeze([...this.klein.keys()].sort()),
			coder: this.coder.id,
			optionalTools: this.optionalTools.snapshot(),
		});
	}
}

export default new MorphChatRuntime();

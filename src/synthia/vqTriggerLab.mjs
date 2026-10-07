import { AutomataMesh, Automaton } from "./ato-core/automaton.mjs";
import {
	TRACE_LAYERS,
	TraceFiringRegistry,
	VQVAE,
	SemanticCompletion,
} from "./ato-core/trace-firing.mjs";
import synthesis from "./synthesisRuntime.mjs";

const DIMENSIONS = Object.freeze(["Movement", "Evolution", "Being", "Design", "Space"]);
const ZODIAC = Object.freeze([
	"Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
	"Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]);

function clampIndex(value, size, fallback = 0) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return fallback;
	return Math.max(0, Math.min(size - 1, Math.trunc(numeric)));
}

export function traceCueFromAddress(address = {}, extras = {}) {
	const dimensionName = String(address.dimension || address.planetaryDimension || "Being");
	const dimension = Math.max(0, DIMENSIONS.indexOf(dimensionName));
	const zodiac = String(address.zodiac || "Aries");
	const sign = Math.max(0, ZODIAC.indexOf(zodiac));
	return Object.freeze({
		dimension,
		// Center is intentionally omitted until a real BodyGraph/center resolver supplies it.
		gate: clampIndex((Number(address.gate) || 1) - 1, 64),
		line: clampIndex((Number(address.line) || 1) - 1, 6),
		color: clampIndex((Number(address.color) || 1) - 1, 6),
		tone: clampIndex((Number(address.tone) || 1) - 1, 6),
		base: clampIndex((Number(address.base) || 1) - 1, 5),
		sign,
		house: clampIndex((Number(address.house) || 1) - 1, 12),
		...extras,
	});
}

function countDense(layer) {
	if (!layer) return 0;
	const weights = layer.W.reduce((sum, row) => sum + row.length, 0);
	return weights + layer.b.length;
}

export function modelFootprint(registry) {
	let parameters = 0;
	const vq = registry.vqvae;
	parameters += countDense(vq.encL1);
	parameters += countDense(vq.encL2);
	parameters += vq.codebook.reduce((sum, row) => sum + row.length, 0);
	parameters += countDense(vq.decL1);
	for (const head of vq.heads) parameters += countDense(head);

	const completion = registry.completion;
	for (const stage of completion.stages) {
		parameters += countDense(stage.l1);
		parameters += countDense(stage.l2);
	}

	return Object.freeze({
		parameters,
		float64Bytes: parameters * Float64Array.BYTES_PER_ELEMENT,
		traceLayers: TRACE_LAYERS.length,
		codebookSize: vq.codebookSize,
		latentDim: vq.latentDim,
	});
}

/**
 * A deliberately small verification runtime for the intended sparse path:
 * cue -> VQ trace -> learned binding -> ATO -> optional Tool Factory -> completion.
 *
 * It is not a controller. Only traces that have learned bindings activate a node.
 */
export class VQTriggerLab {
	constructor({
		mesh = new AutomataMesh(),
		vqvae = new VQVAE(),
		completion = new SemanticCompletion(),
		synthesisRuntime = synthesis,
	} = {}) {
		this.mesh = mesh;
		this.synthesis = synthesisRuntime;
		this.registry = new TraceFiringRegistry({
			mesh,
			vqvae,
			completion,
		});
		this.toolNode = this.#mountToolNode();
	}

	#mountToolNode() {
		const existing = this.mesh.automatons.get("vq-tool-synthesis");
		if (existing) return existing;
		return this.mesh.add(new Automaton({
			id: "vq-tool-synthesis",
			address: {
				mode: "macro",
				gate: 1,
				line: 1,
				color: 1,
				tone: 1,
				base: 1,
			},
			structure: "hexagram",
			activeLevels: [1, 2, 3, 4, 5],
			functionalLevel: "being",
			ports: [],
			metadata: {
				independent: true,
				capabilities: ["tool.synthesize"],
				purpose: "VQ-VAE activation verification",
			},
			implementation: async (cue) => this.synthesis.synthesize({
				purpose: cue.purpose || cue.input || "synthesize a tiny test tool",
				input: cue.input || cue.purpose || "synthesize a tiny test tool",
				...(cue.toolDimension ? { dimension: cue.toolDimension } : {}),
				...(Number.isInteger(cue.toolLevel) ? { level: cue.toolLevel } : {}),
			}),
		}));
	}

	learnToolCue(cue) {
		return this.registry.learn(cue, this.toolNode.id);
	}

	fire(cue, options = {}) {
		return this.registry.fire(cue, options);
	}

	footprint() {
		return modelFootprint(this.registry);
	}

	snapshot() {
		return Object.freeze({
			trace: this.registry.snapshot(),
			footprint: this.footprint(),
			toolNode: this.toolNode.manifest(),
		});
	}
}

export default VQTriggerLab;

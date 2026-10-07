import { AutomataMesh, Automaton } from "./ato-core/automaton.mjs";
import { ATONativeBridge } from "./integrated-tool-factory/ato-native-bridge.mjs";
import {
	IntegratedToolFactory,
	TOOL_LEVELS,
} from "./integrated-tool-factory/integrated-tool-factory.mjs";

const VALID_DIMENSIONS = Object.freeze([
	"Movement",
	"Evolution",
	"Being",
	"Design",
	"Space",
]);

function cleanText(value) {
	return String(value ?? "").trim();
}

function publicTool(tool) {
	const manifest = tool.manifest();
	return Object.freeze({
		id: tool.id,
		name: tool.name,
		addressKey: tool.addressKey,
		dimension: tool.plan.dimension,
		level: tool.plan.level,
		levelName: TOOL_LEVELS[tool.plan.level].name,
		purpose: tool.plan.purpose,
		lifecycle: tool.lifecycle,
		calls: tool.calls,
		manifest,
	});
}

export class SynthesisRuntime {
	constructor({
		factory = new IntegratedToolFactory(),
		mesh = new AutomataMesh(),
	} = {}) {
		this.factory = factory;
		this.mesh = mesh;
		this.bridge = new ATONativeBridge({
			Automaton,
			mesh: this.mesh,
			factory: this.factory,
		});
		this.history = [];
	}

	synthesize({ purpose, input, dimension, level } = {}) {
		const normalizedPurpose = cleanText(purpose || input);
		if (!normalizedPurpose) {
			throw new TypeError("A synthesis purpose or input is required.");
		}
		if (dimension && !VALID_DIMENSIONS.includes(dimension)) {
			throw new TypeError(`Unknown synthesis dimension: ${dimension}`);
		}
		if (
			level !== undefined &&
			(!Number.isInteger(level) || level < 0 || level >= TOOL_LEVELS.length)
		) {
			throw new TypeError("Synthesis level must be an integer from 0 through 7.");
		}

		const request = {
			purpose: normalizedPurpose,
			input: cleanText(input || normalizedPurpose),
		};
		if (dimension) request.dimension = dimension;
		if (level !== undefined) request.level = level;

		const result = this.bridge.generateAndMount(request);
		if (!result.tool) {
			const unresolved = Object.freeze({
				status: result.status,
				reason: result.reason || null,
				candidates: result.candidates || null,
			});
			this.#record("unresolved", unresolved);
			return unresolved;
		}

		const tool = publicTool(result.tool);
		const response = Object.freeze({
			status: result.status,
			generationStatus: result.generationStatus,
			tool,
		});
		this.#record("synthesized", {
			id: tool.id,
			addressKey: tool.addressKey,
			status: response.status,
		});
		return response;
	}

	async run(id, input) {
		const tool = this.factory.tools.get(id);
		if (!tool) throw new Error(`Unknown synthesized tool: ${id}`);
		if (!this.mesh.automatons.has(id)) this.bridge.mount(tool);

		const result = await this.bridge.run(id, input);
		const response = Object.freeze({
			id,
			runId: result.runId,
			output: result.outputs[id],
			visited: result.visited,
		});
		this.#record("run", {
			id,
			runId: response.runId,
		});
		return response;
	}

	exportTool(id, options = {}) {
		return this.factory.exportTool(id, options);
	}

	get(id) {
		const tool = this.factory.tools.get(id);
		return tool ? publicTool(tool) : null;
	}

	list() {
		return [...this.factory.tools.values()]
			.map(publicTool)
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	snapshot() {
		return Object.freeze({
			factory: this.factory.snapshot(),
			bridge: this.bridge.snapshot(),
			history: Object.freeze(this.history.map((entry) => Object.freeze({ ...entry }))),
		});
	}

	#record(type, detail) {
		const record = Object.freeze({
			type,
			detail: Object.freeze({ ...detail }),
			at: new Date().toISOString(),
		});
		this.history.unshift(record);
		this.history.length = Math.min(this.history.length, 100);
		return record;
	}
}

export { TOOL_LEVELS, VALID_DIMENSIONS };
export default new SynthesisRuntime();

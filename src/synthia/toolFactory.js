import stateSpace from "./stateSpace";

export class ToolFactory {
	constructor() {
		this.tools = new Map();
	}

	register(definition) {
		if (!definition?.id || typeof definition.run !== "function") {
			throw new TypeError("A tool requires an id and deterministic run function.");
		}
		const tool = Object.freeze({
			name: definition.id,
			dimension: definition.dimension || "Design",
			version: definition.version || 1,
			run: definition.run,
		});
		this.tools.set(tool.name, tool);
		return tool;
	}

	create({ id, dimension, transform }) {
		return this.register({
			id,
			dimension,
			run(input, context = {}) {
				const output = transform(input, context);
				return { output, address: stateSpace.resolve(`${id}:${JSON.stringify(input)}`, { dimension }) };
			},
		});
	}

	run(id, input, context) {
		const tool = this.tools.get(id);
		if (!tool) throw new Error(`Unknown Synthia tool: ${id}`);
		return tool.run(input, context);
	}

	list() {
		return [...this.tools.values()].map(({ run, ...metadata }) => metadata);
	}
}

const factory = new ToolFactory();

factory.create({ id: "AUTOLING", dimension: "Movement", transform: (input) => ({ tokens: String(input).trim().split(/\s+/), intent: /build|create|make/i.test(input) ? "build" : "understand" }) });
factory.create({ id: "DISEMINER", dimension: "Being", transform: (input) => ({ concepts: [...new Set(String(input).toLowerCase().match(/[a-z0-9_-]{4,}/g) || [])], sourceLength: String(input).length }) });
factory.create({ id: "CONTROL_OF_STYLE", dimension: "Design", transform: (input) => ({ normalized: String(input).replace(/\s+/g, " ").trim() }) });
factory.create({ id: "PARAPHRASER", dimension: "Evolution", transform: (input) => ({ clauses: String(input).split(/[.!?]+/).map((part) => part.trim()).filter(Boolean) }) });

export default factory;

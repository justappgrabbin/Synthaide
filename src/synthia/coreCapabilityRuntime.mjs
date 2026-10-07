
import { AutomataMesh, Automaton } from "./ato-core/automaton.mjs";
import synthesis from "./synthesisRuntime.mjs";

export class CoreCapabilityRuntime {
	constructor({ mesh = new AutomataMesh() } = {}) {
		this.mesh = mesh;
		this.toolSynthesis = this.#mount(new Automaton({
			id: "synthia-tool-synthesis-worker",
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
			ports: [
				{
					id: "request",
					direction: "input",
					type: "tool-request",
					schemaVersion: "1",
				},
				{
					id: "result",
					direction: "output",
					type: "tool-result",
					schemaVersion: "1",
				},
			],
			metadata: {
				family: "synthia-core-capability",
				independent: true,
				capabilities: Object.freeze(["tool.synthesize", "tool.run"]),
			},
			implementation: async (input) => {
				const operation = input?.op || "synthesize";
				if (operation === "synthesize") {
					return synthesis.synthesize(input);
				}
				if (operation === "run") {
					return synthesis.run(input.id, input.input);
				}
				throw new RangeError(`Unknown tool synthesis operation: ${operation}`);
			},
		}));
	}

	#mount(automaton) {
		if (this.mesh.automatons.has(automaton.id)) {
			return this.mesh.automatons.get(automaton.id);
		}
		return this.mesh.add(automaton);
	}

	snapshot() {
		return this.mesh.snapshot();
	}
}

export default new CoreCapabilityRuntime();

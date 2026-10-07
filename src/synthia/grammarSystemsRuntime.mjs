import { AutomataMesh } from "./ato-core/automaton.mjs";
import { degGrammarAutomaton } from "./deg/grammar.mjs";
import { geoDegAutomaton } from "./geo-deg/geometry.mjs";

/**
 * Shared-roof mount for two independent grammar automatons.
 *
 * Either factory can be used alone. This runtime only connects their declared
 * production-grammar contract when coordinated execution is wanted.
 */
export class GrammarSystemsRuntime {
	constructor({ mesh = new AutomataMesh() } = {}) {
		this.mesh = mesh;
		this.deg = this.#mount(degGrammarAutomaton());
		this.geoDeg = this.#mount(geoDegAutomaton());
		this.connection = this.mesh.connect(this.deg.id, this.geoDeg.id, {
			outputPort: "grammar",
			inputPort: "grammar",
			operator: "grammar-to-geometry",
		});
	}

	#mount(automaton) {
		if (this.mesh.automatons.has(automaton.id)) {
			return this.mesh.automatons.get(automaton.id);
		}
		return this.mesh.add(automaton);
	}

	async learn(examples, options = {}) {
		return this.deg.call({ op: "learn", examples, options });
	}

	async generate(options = {}) {
		return this.deg.call({ op: "generate", options });
	}

	async index(grammar, options = {}) {
		return this.geoDeg.call({ op: "build", grammar, options });
	}

	async learnAndIndex(examples, options = {}) {
		const run = await this.mesh.run(this.deg.id, {
			op: "learn",
			examples,
			options,
		});
		return Object.freeze({
			grammar: run.outputs[this.deg.id],
			geometry: run.outputs[this.geoDeg.id],
			visited: run.visited,
		});
	}

	snapshot() {
		return Object.freeze({
			deg: this.deg.ownedState.snapshot(),
			geoDeg: this.geoDeg.ownedState.snapshot(),
			mesh: this.mesh.snapshot(),
			connection: this.connection,
		});
	}
}

export default new GrammarSystemsRuntime();

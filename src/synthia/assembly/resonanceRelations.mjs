
import componentRegistry from "../identity/componentRegistry.mjs";

const VALID_TYPES = new Set([
	"person",
	"place",
	"thing",
	"agent",
	"tool",
	"capability",
	"project",
	"artifact",
	"component",
	"file",
]);

function dimensionOf(address = {}) {
	return address.dimension || address.planetaryDimension || "Being";
}

function structuralNode(address = {}) {
	const gate = Math.min(64, Math.max(1, Math.trunc(Number(address.gate) || 1)));
	return `${dimensionOf(address)}:G${gate}`;
}

export class ResonanceRelations {
	constructor({ meshRuntime, registry = componentRegistry } = {}) {
		if (!meshRuntime) throw new TypeError("ResonanceRelations requires LivingMeshRuntime.");
		this.id = "synthia-resonance-relations";
		this.meshRuntime = meshRuntime;
		this.registry = registry;
		const identity = this.registry.identify({
			id: this.id,
			name: "Synthia Resonance Relations",
			kind: "component",
			what: {
				capabilities: [
					"entity.register",
					"entity.relate",
					"resonance.observe",
					"resonance.query",
				],
			},
			why:
				"Connects addressed people, places, things, agents, tools, and artifacts through learned relationship weights.",
			how: {
				mechanism:
					"addressed entity -> mesh relationship -> verified interaction outcome -> bounded resonance update",
			},
			relationships: [
				{ type: "uses", target: "living-mesh" },
				{ type: "supports", target: "synthia-asset-graph" },
			],
			behaviors: [
				"register-public-identity",
				"record-relationship",
				"learn-from-outcome",
				"query-neighbors",
			],
			dependencies: ["living-mesh", "component-registry"],
			when: { activation: "entity or relationship enters Synthia" },
			provenance: { source: "integrated-living-mesh" },
		});
		this.address = identity.address;
		this.capabilities = Object.freeze(
			identity.what.value.capabilities,
		);
		this.entities = new Map();
	}

	register(input = {}) {
		const kind = String(input.kind || "thing");
		if (!VALID_TYPES.has(kind)) {
			throw new RangeError(`Unsupported resonance entity kind: ${kind}`);
		}
		const identity = this.registry.has(input.id)
			? this.registry.requireReady(input.id)
			: this.registry.identify({
				...input,
				kind,
				what: input.what ?? {
					capabilities: [...(input.capabilities || [])],
					description: input.description || "",
				},
				why:
					input.why ??
					"Participates as an addressed entity in Synthia's resonance network.",
				how: input.how ?? { interface: "resonance-entity" },
				relationships: input.relationships ?? [],
				behaviors: input.behaviors ?? [],
				dependencies: input.dependencies ?? [],
				when: input.when ?? { activation: "relationship-dependent" },
				provenance:
					input.provenance ?? { source: "runtime-entity-registration" },
			});
		if (!identity.ready) {
			throw new Error(`Entity ${identity.id} is not fully identified.`);
		}

		const publicMeta = Object.freeze({
			kind,
			name: identity.who.value.name,
			address: identity.address,
			capabilities: Object.freeze([...(input.capabilities || [])]),
			...(input.public || {}),
		});
		this.entities.set(identity.id, publicMeta);
		this.meshRuntime.resonance.addNode(identity.id, publicMeta);
		this.meshRuntime.engine.mesh.addEdge(
			"knowledge",
			identity.id,
			structuralNode(identity.address),
			"has-addressed-position",
			{ kind },
		);
		return identity;
	}

	relate({
		from,
		to,
		type = "related-to",
		projection = "phase",
		outcome = 0,
		evidence = null,
		verified = true,
		metadata = {},
	} = {}) {
		if (!this.entities.has(String(from)) || !this.entities.has(String(to))) {
			throw new Error("Both resonance entities must be registered before relating them.");
		}
		const edge = this.meshRuntime.engine.mesh.addEdge(
			projection,
			String(from),
			String(to),
			String(type),
			{
				...metadata,
				evidence,
				verified: Boolean(verified),
			},
		);
		const learned = this.meshRuntime.resonance.observe({
			a: String(from),
			b: String(to),
			outcome,
			type,
			evidence,
			verified,
		});
		return Object.freeze({ edge, resonance: learned });
	}

	observe(input = {}) {
		const { a, b } = input;
		if (!this.entities.has(String(a)) || !this.entities.has(String(b))) {
			throw new Error("Both resonance entities must be registered before observation.");
		}
		return this.meshRuntime.resonance.observe(input);
	}

	neighbors(id) {
		const wanted = String(id);
		const snapshot = this.meshRuntime.resonance.snapshot();
		return Object.freeze(
			snapshot.edges
				.filter((edge) => edge.a === wanted || edge.b === wanted)
				.map((edge) =>
					Object.freeze({
						id: edge.a === wanted ? edge.b : edge.a,
						weight: edge.weight,
						observations: edge.observations,
						evidence: Object.freeze([...edge.evidence]),
					}),
				)
				.sort((left, right) => right.weight - left.weight),
		);
	}

	async run(input = {}) {
		switch (input.op) {
			case "register":
				return this.register(input.entity || input);
			case "relate":
				return this.relate(input);
			case "observe":
				return this.observe(input);
			case "neighbors":
				return this.neighbors(input.id);
			case "snapshot":
				return this.snapshot();
			default:
				throw new Error(`Unknown Resonance Relations operation: ${input.op}`);
		}
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.resonance-relations.v1",
			entities: Object.freeze(
				[...this.entities.entries()].map(([id, meta]) =>
					Object.freeze({ id, ...meta }),
				),
			),
			resonance: this.meshRuntime.resonance.snapshot(),
		});
	}
}

export default ResonanceRelations;

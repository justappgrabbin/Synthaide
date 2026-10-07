
import { analyzeProject } from "../morph-engine/ast/analyze.mjs";
import componentRegistry from "../identity/componentRegistry.mjs";

const ENTITY_KINDS = Object.freeze([
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

function key(from, to, type) {
	return `${String(from)}|${String(type)}|${String(to)}`;
}

function clone(value) {
	return value == null ? value : structuredClone(value);
}

export class AssetGraph {
	constructor({ registry = componentRegistry, onRelationship = null } = {}) {
		this.id = "synthia-asset-graph";
		this.registry = registry;
		this.onRelationship = onRelationship;
		this.nodes = new Map();
		this.expectedEdges = new Map();
		this.actualEdges = new Map();
		this.importDiagnostics = [];
	}

	registerEntity(input = {}) {
		const kind = String(input.kind || "thing");
		if (!ENTITY_KINDS.includes(kind)) {
			throw new RangeError(`Unsupported asset-graph entity kind: ${kind}`);
		}
		const identity = this.registry.identify({
			...input,
			kind,
			what: input.what ?? {
				capabilities: [...(input.capabilities || [])],
				stateOwned: input.stateOwned || [],
			},
			why: input.why ?? "Participates in Synthia's addressed relationship graph.",
			how: input.how ?? {
				interface: input.interface || "relationship-node",
			},
			relationships: input.relationships ?? [],
			behaviors: input.behaviors ?? [],
			dependencies: input.dependencies ?? [],
			when: input.when ?? { activation: "relationship-dependent" },
			provenance: input.provenance ?? { source: "integrated-runtime" },
		});
		this.nodes.set(identity.id, Object.freeze({
			id: identity.id,
			kind,
			name: identity.who.value.name,
			address: identity.address,
			capabilities: Object.freeze([...(input.capabilities || [])]),
			public: Object.freeze({ ...(input.public || {}) }),
		}));
		return identity;
	}

	addIdentity(identity, { kind = null, capabilities = [] } = {}) {
		if (!identity?.id || !identity?.address) {
			throw new TypeError("AssetGraph.addIdentity requires an addressed identity.");
		}
		this.registry.requireReady(identity.id);
		const resolvedKind = kind || identity.who.value.kind || "component";
		this.nodes.set(identity.id, Object.freeze({
			id: identity.id,
			kind: resolvedKind,
			name: identity.who.value.name,
			address: identity.address,
			capabilities: Object.freeze([...capabilities]),
			public: Object.freeze({}),
		}));
		return this.nodes.get(identity.id);
	}

	expect(from, to, {
		type = "depends-on",
		projection = "dependency",
		reason = "",
		metadata = {},
	} = {}) {
		if (!this.nodes.has(String(from)) || !this.nodes.has(String(to))) {
			throw new Error("Expected relationships require both addressed nodes.");
		}
		const edge = Object.freeze({
			from: String(from),
			to: String(to),
			type: String(type),
			projection: String(projection),
			reason: String(reason),
			metadata: Object.freeze({ ...metadata }),
		});
		this.expectedEdges.set(key(from, to, type), edge);
		return edge;
	}

	connect(from, to, {
		type = "related-to",
		projection = "phase",
		evidence = null,
		metadata = {},
	} = {}) {
		if (!this.nodes.has(String(from)) || !this.nodes.has(String(to))) {
			throw new Error("Relationships require both addressed nodes.");
		}
		const edge = Object.freeze({
			from: String(from),
			to: String(to),
			type: String(type),
			projection: String(projection),
			evidence: clone(evidence),
			metadata: Object.freeze({ ...metadata }),
		});
		this.actualEdges.set(key(from, to, type), edge);
		this.onRelationship?.(edge);
		return edge;
	}

	ingestProject(assets = [], {
		projectId = "current-project",
		projectName = "Current Project",
	} = {}) {
		if (!this.nodes.has(projectId)) {
			this.registerEntity({
				id: projectId,
				name: projectName,
				kind: "project",
				what: { capabilities: ["source.contains"] },
				why: "Represents the source project currently being inspected.",
				how: { interface: "asset-project" },
				relationships: [],
				behaviors: ["contains-source-assets"],
				dependencies: [],
				when: { activation: "project-open" },
				provenance: { source: "local-project" },
			});
		}

		const analysis = analyzeProject(assets);
		for (const asset of assets) {
			const name = String(asset.name || asset.filename || "asset");
			const fileId = `file:${projectId}:${name}`;
			if (!this.nodes.has(fileId)) {
				this.registerEntity({
					id: fileId,
					name,
					kind: "file",
					what: { capabilities: ["source.asset"], language: "javascript" },
					why: "Represents an addressed source asset in the current project.",
					how: { interface: "source-file" },
					relationships: [{ type: "contained-by", target: projectId }],
					behaviors: ["parse", "rewrite"],
					dependencies: [],
					when: { activation: "project-analysis" },
					provenance: { source: "local-project", projectId },
				});
			}
			this.connect(projectId, fileId, {
				type: "contains",
				projection: "knowledge",
			});
		}

		for (const edge of analysis.edges || []) {
			const fromId = `file:${projectId}:${edge.from}`;
			const toId = edge.resolved
				? `file:${projectId}:${edge.resolved}`
				: null;
			if (toId && this.nodes.has(fromId) && this.nodes.has(toId)) {
				this.connect(fromId, toId, {
					type: "imports",
					projection: "dependency",
					metadata: { source: edge.to },
				});
			}
		}
		this.importDiagnostics = Object.freeze(
			(analysis.edges || [])
				.filter((edge) => !edge.external && !edge.resolved)
				.map((edge) => Object.freeze({
					from: edge.from,
					source: edge.to,
					type: "unresolved-import",
				})),
		);
		return Object.freeze({
			projectId,
			files: analysis.files,
			edges: analysis.edges,
			errors: analysis.errors,
			unresolved: this.importDiagnostics,
		});
	}

	providers(capability) {
		const wanted = String(capability);
		return Object.freeze(
			[...this.nodes.values()].filter((node) =>
				node.capabilities.includes(wanted),
			),
		);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.asset-graph.v1",
			nodes: Object.freeze([...this.nodes.values()]),
			expectedEdges: Object.freeze([...this.expectedEdges.values()]),
			actualEdges: Object.freeze([...this.actualEdges.values()]),
			importDiagnostics: Object.freeze([...this.importDiagnostics]),
		});
	}
}

export { ENTITY_KINDS };
export default AssetGraph;

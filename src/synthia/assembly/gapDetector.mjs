
function edgeKey(edge) {
	return `${edge.from}|${edge.type}|${edge.to}`;
}

export class GapDetector {
	constructor() {
		this.id = "synthia-gap-detector";
		this.history = [];
	}

	detect(assetGraph, {
		requiredCapabilities = [],
	} = {}) {
		if (!assetGraph) throw new TypeError("GapDetector requires an AssetGraph.");

		const actual = new Set(
			[...assetGraph.actualEdges.values()].map(edgeKey),
		);
		const relationshipGaps = [...assetGraph.expectedEdges.values()]
			.filter((edge) => !actual.has(edgeKey(edge)))
			.map((edge) => Object.freeze({
				kind: "missing-relationship",
				from: edge.from,
				to: edge.to,
				type: edge.type,
				projection: edge.projection,
				reason: edge.reason,
			}));

		const capabilityGaps = requiredCapabilities
			.filter((capability) => assetGraph.providers(capability).length === 0)
			.map((capability) => Object.freeze({
				kind: "missing-capability",
				capability: String(capability),
			}));

		const importGaps = [...assetGraph.importDiagnostics].map((item) =>
			Object.freeze({
				kind: "unresolved-import",
				from: item.from,
				source: item.source,
			}),
		);

		const gaps = Object.freeze([
			...relationshipGaps,
			...capabilityGaps,
			...importGaps,
		]);
		const result = Object.freeze({
			id: `gap-scan-${this.history.length + 1}`,
			gaps,
			count: gaps.length,
			complete: gaps.length === 0,
			at: new Date().toISOString(),
		});
		this.history.unshift(result);
		this.history.length = Math.min(this.history.length, 64);
		return result;
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.gap-detector.v1",
			history: Object.freeze([...this.history]),
		});
	}
}

export default GapDetector;

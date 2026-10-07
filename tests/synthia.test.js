import { describe, expect, it } from "vitest";
import { StateSpace, ADDRESS_FIELDS, DIMENSIONS } from "synthia/stateSpace";
import { ToolFactory } from "synthia/toolFactory";
import ato from "synthia/atoEngine";

describe("Synthia state substrate", () => {
	it("contains 64 gates across all five dimensions", () => {
		const state = new StateSpace();
		expect(DIMENSIONS).toHaveLength(5);
		expect(state.nodes).toHaveLength(320);
		for (const dimension of DIMENSIONS) {
			expect(state.nodes.filter((node) => node.dimension === dimension)).toHaveLength(64);
		}
	});

	it("resolves deterministic complete canonical addresses", () => {
		const state = new StateSpace();
		const first = state.resolve("same input");
		expect(first).toEqual(state.resolve("same input"));
		expect(ADDRESS_FIELDS.every((field) => first[field] !== undefined)).toBe(true);
		expect(Object.keys(first)).toHaveLength(13);
	});
});

describe("ATO and Tool Factory", () => {
	it("creates and runs deterministic tools", () => {
		const factory = new ToolFactory();
		factory.create({ id: "DOUBLE", dimension: "Design", transform: (value) => value * 2 });
		expect(factory.run("DOUBLE", 4).output).toBe(8);
	});

	it("routes build intent through the current searched execution stack", async () => {
		const result = await ato.process("build a local state tool");
		expect(result.path).toEqual([
			"semantic-mesh",
			"recognizer",
			"micro-state-space",
			"composition-predictor",
			"puct",
			"task-assignment",
			"execute",
			"score",
			"learn",
		]);
		expect(result.addressText).toContain(":G");
		expect(result.result.selected.candidate.kind).toBe("tool-synthesis");
		const synthesis = result.result.executions.find(
			(item) => item.capability === "tool.synthesize",
		);
		expect(synthesis?.status).toBe("complete");
		expect(synthesis?.output?.tool).toBeTruthy();
	});
});

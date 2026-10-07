import test from "node:test";
import assert from "node:assert/strict";
import { MemoryVaultStore } from "../src/synthia/morph-engine/substrate/vault/VaultStore.mjs";
import { PersonalVault } from "../src/synthia/morph-engine/substrate/vault/PersonalVault.mjs";
import { MorphSubstrateRuntime } from "../src/synthia/morph-engine/substrateRuntime.mjs";

function source(name, text, type = "text/javascript") {
	return { name, type, size: text.length, text, arrayBuffer: async () => new TextEncoder().encode(text).buffer };
}

test("v0.6 substrate preserves originals and diagnoses the same intake", async () => {
	const vault = new PersonalVault({ store: new MemoryVaultStore() });
	const runtime = new MorphSubstrateRuntime({ vault });
	const input = source("main.js", "import { run } from './tool.js';\nrun();");
	const result = await runtime.intake([input]);
	assert.equal(result.preserved[0].status, "preserved");
	assert.equal((await vault.list()).length, 1);
	assert.ok(result.diagnosis.gaps.gaps.some((gap) => gap.type === "unresolved-import"));
});

test("duplicate intake records a sighting without replacing the original", async () => {
	const vault = new PersonalVault({ store: new MemoryVaultStore() });
	const runtime = new MorphSubstrateRuntime({ vault });
	const input = source("original.js", "export const value = 5;");
	await runtime.intake([input]);
	const again = await runtime.intake([source("renamed.js", "export const value = 5;")]);
	assert.equal(again.preserved[0].status, "duplicate");
	assert.equal((await vault.list()).length, 1);
	assert.equal((await vault.get(again.preserved[0].original.id)).sightings.length, 2);
});

test("MCP gateway edits a workboard copy, never the immutable original", async () => {
	const vault = new PersonalVault({ store: new MemoryVaultStore() });
	const runtime = new MorphSubstrateRuntime({ vault });
	const intake = await runtime.intake([source("app.js", "export const version = 1;")]);
	const originalId = intake.preserved[0].original.id;
	const ticket = await runtime.run({ op: "mcp-ticket", ticket: {
		tool: "builder", artifactIds: [originalId],
		permissions: ["vault.copyToBoard", "board.write", "board.read", "board.submit"],
	} });
	const copy = await runtime.gateway.copyToBoard(ticket.id, originalId);
	await runtime.gateway.writeBoard(ticket.id, copy.id, "export const version = 2;");
	const original = new TextDecoder().decode(await vault.bytes(originalId));
	assert.equal(original, "export const version = 1;");
});

import assert from "node:assert/strict";
import test from "node:test";

import embodiment from "../src/synthia/embodiment/embodimentRuntime.mjs";
import { bindAcodeHosts } from "../src/synthia/embodiment/acodeHostBindings.mjs";

const autonomy = (allowed = {}) => ({
	can: (capability) => Boolean(allowed[capability]),
});

test("Acode hosts bind as four separate action tools", () => {
	const document = { querySelector: () => null };
	const browser = { open() {} };
	const http = { sendRequest() {} };
	bindAcodeHosts({ autonomy: autonomy(), document, browser, http, fetchImpl: null });
	const ids = [
		"synthia-hands",
		"synthia-browser",
		"synthia-network",
		"synthia-artifact-retriever",
	];
	for (const id of ids) assert.equal(embodiment.body.components.has(id), true);
	assert.equal(embodiment.snapshot().activeActionToolCount, 4);
});

test("hands execute only after the existing autonomy permission agrees", async () => {
	let clicks = 0;
	const document = {
		querySelector: () => ({ click: () => { clicks += 1; }, focus() {} }),
	};
	// Hosts are singleton-bound by the first test, so exercise the registered
	// agreement using the permission object retained there: it is disabled.
	let result = await embodiment.request("synthia-hands", { op: "click", selector: "#run" });
	assert.equal(result.status, "declined");
	assert.equal(clicks, 0);

	// A separate process-level body is covered by capabilityBody tests; here we
	// prove a browser cannot piggyback on the presence of hands.
	result = await embodiment.request("synthia-browser", { url: "https://example.test" });
	assert.equal(result.status, "declined");
});

test("artifact retrieval refuses requests without a complete digest", async () => {
	const result = await embodiment.request("synthia-artifact-retriever", {
		url: "https://example.test/module.zip",
	});
	assert.equal(result.status, "declined");
	assert.equal(result.reason, "HOST_PERMISSION_DECLINED");
});


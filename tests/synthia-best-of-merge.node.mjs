import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import synthia from "../src/synthia/synthiaRuntime.mjs";

test("best-of merge is additive", () => {
	assert.equal(typeof synthia.talk, "function");

	const welcome = fs.readFileSync(
		new URL("../src/pages/welcome/welcome.js", import.meta.url),
		"utf8",
	);
	assert.match(welcome, /WHO: SPACE · WHAT: MOVEMENT/);
	assert.match(welcome, /show\("state"\)/);
	assert.match(welcome, /await synthia\.process\(text\)/);

	const manifest = JSON.parse(fs.readFileSync(
		new URL("../references/BEST-OF-SOURCE-MANIFEST.json", import.meta.url),
		"utf8",
	));
	assert.ok(manifest.some((item) => item.sourceZip.includes("You-n-i-verse-browser")));
	assert.ok(manifest.some((item) => item.sourceZip.includes("Self-Discovery")));
});

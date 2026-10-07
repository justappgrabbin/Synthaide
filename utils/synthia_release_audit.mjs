
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const forbiddenDirs = new Set([
	"synthia-donors",
	"synthia-donor-tests",
	"restored-systems",
	"donor-zips",
]);
const archiveExtensions = new Set([
	".zip",
	".tar",
	".tgz",
	".gz",
	".bz2",
	".xz",
	".7z",
	".rar",
]);
const requiredFiles = [
	"src/synthia/semantic-mesh/engine/synthia.js",
	"src/synthia/morph-engine/changeRuntime.mjs",
	"src/synthia/morph-engine/substrateRuntime.mjs",
	"src/synthia/morph-engine/substrate/core/MorphEngine.mjs",
	"src/synthia/morph-engine/substrate/bridge/BridgeBuilder.mjs",
	"src/synthia/morph-engine/substrate/vault/PersonalVault.mjs",
	"src/synthia/morph-engine/substrate/vault/VaultMCPGateway.mjs",
	"src/synthia/assembly/assetGraph.mjs",
	"src/synthia/assembly/gapDetector.mjs",
	"src/synthia/assembly/resonanceRelations.mjs",
	"src/synthia/assembly/selfIntegrationRuntime.mjs",
	"src/synthia/identity/componentRegistry.mjs",
	"src/synthia/embodiment/capabilityBody.mjs",
	"src/synthia/embodiment/embodimentRuntime.mjs",
	"src/synthia/embodiment/acodeHostBindings.mjs",
	"src/synthia/remote/CapabilityCatalog.mjs",
	"src/synthia/remote/CapabilityCatalogStore.mjs",
	"src/synthia/remote/RemoteCapabilityRuntime.mjs",
	"src/synthia/remote/browserModuleLoader.mjs",
	"SYNTHIA-ANATOMY-AUDIT-v0.8.md",
	"src/synthia/native-grammar/runtime.mjs",
	"src/synthia/native-grammar/primitiveLexicon.mjs",
	"src/synthia/native-grammar/positionGrammar.mjs",
	"src/synthia/native-grammar/relationshipGrammar.mjs",
	"src/synthia/native-grammar/scaleEngine.mjs",
	"src/synthia/native-grammar/realityCorrection.mjs",
	"src/synthia/native-grammar/autolingAdapter.mjs",
];

const failures = [];

function walk(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const absolute = path.join(directory, entry.name);
		const relative = path.relative(root, absolute).split(path.sep).join("/");
		if (entry.isDirectory()) {
			// Installed dependencies and generated build output are not app source.
			if (["node_modules", ".git", "platforms", "build"].includes(entry.name)) continue;
			if (forbiddenDirs.has(entry.name)) {
				failures.push(`forbidden directory: ${relative}`);
				continue;
			}
			walk(absolute);
			continue;
		}
		if (archiveExtensions.has(path.extname(entry.name).toLowerCase())) {
			failures.push(`nested archive: ${relative}`);
		}
	}
}

walk(root);

for (const relative of requiredFiles) {
	if (!fs.existsSync(path.join(root, relative))) {
		failures.push(`missing integrated runtime file: ${relative}`);
	}
}

// The native editor plugins are source, not generated Cordova caches.
// Verify every local dependency before calling a checkpoint buildable.
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
for (const section of ["dependencies", "devDependencies"]) {
	for (const [name, spec] of Object.entries(packageJson[section] || {})) {
		if (!spec.startsWith("file:")) continue;
		const source = path.join(root, spec.slice(5));
		if (!fs.existsSync(path.join(source, "package.json"))) {
			failures.push(`missing local dependency source: ${name} (${spec})`);
		}
	}
}

const config = fs.readFileSync(path.join(root, "config.xml"), "utf8");
if (!/\bid="world\.synthia\.acode"/.test(config)) {
	failures.push("config.xml package id is not world.synthia.acode");
}

if (failures.length) {
	console.error("Synthia release audit failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exitCode = 1;
} else {
	console.log("Synthia release audit passed.");
	console.log("No donor warehouse, restored donor tree, or nested archive is present.");
}

import embodiment from "./embodimentRuntime.mjs";

function validHttpUrl(value) {
	try {
		const url = new URL(String(value));
		return ["http:", "https:"].includes(url.protocol) ? url.href : null;
	} catch {
		return null;
	}
}

function nativeRequest(http, task) {
	return new Promise((resolve, reject) => {
		http.sendRequest(
			task.url,
			{
				method: String(task.method || "GET").toUpperCase(),
				data: task.data,
				headers: task.headers || {},
				responseType: task.responseType || "arraybuffer",
			},
			resolve,
			reject,
		);
	});
}

async function digestHex(bytes) {
	if (!globalThis.crypto?.subtle) return null;
	const data = bytes instanceof ArrayBuffer
		? bytes
		: new TextEncoder().encode(String(bytes)).buffer;
	const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)]
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}

/** Bind the actual Acode/Cordova hosts once the shell is available. */
export function bindAcodeHosts({
	autonomy,
	system = globalThis.system,
	browser = null,
	http = globalThis.cordova?.plugin?.http,
	document = globalThis.document,
	fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
	if (!autonomy) throw new TypeError("Acode host bindings require autonomy");
	const registered = [];

	const bindOnce = (definition) => {
		if (embodiment.body.components.has(definition.id)) return;
		embodiment.bindHost(definition);
		registered.push(definition.id);
	};

	bindOnce({
		id: "synthia-hands",
		capabilities: ["device.dom.click", "device.dom.focus"],
		available: () => Boolean(document?.querySelector),
		permitted: (_operation, task) =>
			autonomy.can("allowExecution") &&
			["click", "focus"].includes(task?.op) &&
			typeof task?.selector === "string",
		execute: (task) => {
			const target = document.querySelector(task.selector);
			if (!target) throw new Error(`No element matches ${task.selector}`);
			if (task.op === "click") target.click();
			else target.focus();
			return Object.freeze({ performed: task.op, selector: task.selector });
		},
	});

	bindOnce({
		id: "synthia-browser",
		capabilities: ["browser.open", "browser.navigate"],
		available: () => Boolean(browser?.open || system?.openInBrowser),
		permitted: (_operation, task) =>
			autonomy.can("allowNetwork") && Boolean(validHttpUrl(task?.url)),
		execute: (task) => {
			const url = validHttpUrl(task.url);
			if (task.external === true) {
				if (!system?.openInBrowser) throw new Error("External browser host unavailable");
				system.openInBrowser(url);
				return Object.freeze({ opened: url, surface: "external" });
			}
			if (!browser?.open) throw new Error("Embedded browser host unavailable");
			browser.open(url);
			return Object.freeze({ opened: url, surface: "embedded" });
		},
	});

	bindOnce({
		id: "synthia-network",
		capabilities: ["network.request", "network.download"],
		available: () => Boolean(http?.sendRequest || fetchImpl),
		permitted: (_operation, task) =>
			autonomy.can("allowNetwork") && Boolean(validHttpUrl(task?.url)),
		execute: async (task) => {
			const normalized = { ...task, url: validHttpUrl(task.url) };
			if (http?.sendRequest) return nativeRequest(http, normalized);
			const response = await fetchImpl(normalized.url, {
				method: normalized.method || "GET",
				headers: normalized.headers,
				body: normalized.data,
			});
			if (!response.ok) throw new Error(`Network request failed: ${response.status}`);
			return Object.freeze({
				status: response.status,
				data: normalized.responseType === "text"
					? await response.text()
					: await response.arrayBuffer(),
			});
		},
	});

	bindOnce({
		id: "synthia-artifact-retriever",
		capabilities: ["artifact.fetch", "artifact.verify"],
		available: () => Boolean(http?.sendRequest || fetchImpl),
		permitted: (_operation, task) =>
			autonomy.can("allowNetwork") &&
			Boolean(validHttpUrl(task?.url)) &&
			/^[a-f0-9]{64}$/i.test(String(task?.sha256 || "")),
		execute: async (task) => {
			const response = http?.sendRequest
				? await nativeRequest(http, { ...task, responseType: "arraybuffer" })
				: await (async () => {
					const fetched = await fetchImpl(validHttpUrl(task.url));
					if (!fetched.ok) throw new Error(`Artifact fetch failed: ${fetched.status}`);
					return { status: fetched.status, data: await fetched.arrayBuffer() };
				})();
			const actual = await digestHex(response.data);
			if (!actual) throw new Error("SHA-256 verification is unavailable on this host");
			if (actual !== String(task.sha256).toLowerCase()) {
				throw new Error("Artifact digest mismatch");
			}
			return Object.freeze({
				status: response.status,
				sha256: actual,
				bytes: response.data,
				verified: true,
			});
		},
	});

	return Object.freeze({ registered: Object.freeze(registered), snapshot: embodiment.snapshot() });
}

export default bindAcodeHosts;


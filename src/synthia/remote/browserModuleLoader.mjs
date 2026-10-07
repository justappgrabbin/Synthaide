export async function browserModuleLoader({ text, entry }) {
	if (!globalThis.Blob || !globalThis.URL?.createObjectURL) {
		throw new Error("Browser module loading is unavailable on this host");
	}
	const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
	try {
		return await import(/* webpackIgnore: true */ url);
	} finally {
		URL.revokeObjectURL(url);
	}
}

export default browserModuleLoader;


export const LAB_SOURCES = Object.freeze([
	{ id: "biorhythm", source: "hXR16F/Biorhythm", role: "temporal-cycle-adapter", license: "GPL-3.0", incorporation: "clean-js-reimplementation" },
	{ id: "chemistry-2d", source: "Deepika25700/Chemistry-lab-simulator", role: "reaction-state-machine", license: "MIT", incorporation: "native-adapter" },
	{ id: "chemistry-3d", source: "PanMig/Chemistry-Lab", role: "optional-3d-experience", license: "Apache-2.0", incorporation: "remote-or-build-pack" },
	{ id: "scoup", source: "doi:10.1101/2025.06.14.659628", role: "codon-evolution-experiment", license: "paper-method", incorporation: "independent-experimental-operator" },
	{ id: "hd-reader", source: "mengke-wang/human-design-reader", role: "local-js-chart-provider", license: "MIT", incorporation: "provider-bridge" },
	{ id: "hd-llm", source: "joyozhang333-lgtm/human-design-llm", role: "bodygraph-and-report-provider", license: "MIT", incorporation: "provider-bridge-no-required-llm" },
	{ id: "eon", source: "sjkim1127/Eon", role: "rust-wasm-symbolic-provider", license: "repository-specific", incorporation: "optional-wasm-provider" },
	{ id: "soul-codex", source: "Bboy9090/Ultimate-SoulCodex", role: "experience-reference", license: "verify-before-code-import", incorporation: "interface-patterns-only" },
	{ id: "eldermind", source: "ElderMindAI/eldermind-core", role: "comparison-reference", license: "source-available-restricted", incorporation: "blocked-without-written-permission" },
]);

export function sourceById(id) { return LAB_SOURCES.find(source => source.id === id) ?? null; }

const PROVIDERS = new Set(["human-design-reader", "human-design-llm", "eon"]);

export function normalizeHumanDesignChart(provider, chart) {
	if (!PROVIDERS.has(provider)) throw new RangeError(`unsupported Human Design provider: ${provider}`);
	if (!chart || typeof chart !== "object") throw new TypeError("chart must be an object");
	const foundations = chart.foundations ?? chart.summary ?? chart;
	return {
		provider,
		facts: {
			type: foundations.type ?? null,
			strategy: foundations.strategy ?? null,
			authority: foundations.authority ?? null,
			profile: foundations.profile ?? null,
		},
		centers: chart.centers ?? [], channels: chart.channels ?? [], activations: chart.activations ?? [],
		trustChain: chart.calculation?.trustChain ?? chart.trustChain ?? null,
		raw: chart,
	};
}

export async function calculateWithProvider(provider, input, adapters) {
	const calculate = adapters?.[provider];
	if (typeof calculate !== "function") return { status: "capability-required", provider, input };
	return { status: "calculated", chart: normalizeHumanDesignChart(provider, await calculate(input)) };
}

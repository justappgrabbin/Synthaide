const CODONS = /^[ACGT]{3}$/;

function normal(rng = Math.random) {
	const u = Math.max(Number.EPSILON, rng());
	const v = Math.max(Number.EPSILON, rng());
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function evolveCodonState({ codons, fitness, optimum = 0, theta = 0.25, sigma = 0.1, dt = 1, rng = Math.random }) {
	if (!Array.isArray(codons) || codons.some(codon => !CODONS.test(codon))) throw new TypeError("codons must be DNA triplets using A/C/G/T");
	if (!Number.isFinite(fitness)) throw new TypeError("fitness must be finite");
	const drift = theta * (optimum - fitness) * dt;
	const diffusion = sigma * Math.sqrt(dt) * normal(rng);
	return { codons: [...codons], previousFitness: fitness, fitness: fitness + drift + diffusion, drift, diffusion, model: "ornstein-uhlenbeck-selection", evidenceTier: "research-experiment" };
}

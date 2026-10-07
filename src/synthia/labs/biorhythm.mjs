const DAY_MS = 86_400_000;

export const BIORHYTHM_CYCLES = Object.freeze({ physical: 23, emotional: 28, intellectual: 33 });

function asDate(value, label) {
	const date = value instanceof Date ? new Date(value) : new Date(value);
	if (Number.isNaN(date.valueOf())) throw new TypeError(`${label} must be a valid date`);
	return date;
}

export function calculateBiorhythm(birthDate, at = new Date()) {
	const birth = asDate(birthDate, "birthDate");
	const observedAt = asDate(at, "at");
	const ageDays = (observedAt.valueOf() - birth.valueOf()) / DAY_MS;
	const cycles = Object.fromEntries(Object.entries(BIORHYTHM_CYCLES).map(([name, period]) => {
		const phase = ((ageDays % period) + period) % period;
		return [name, { periodDays: period, phaseDays: phase, value: Math.sin(2 * Math.PI * ageDays / period) }];
	}));
	return { kind: "experimental-cycle", predictiveClaim: false, birthDate: birth.toISOString(), at: observedAt.toISOString(), ageDays, cycles };
}

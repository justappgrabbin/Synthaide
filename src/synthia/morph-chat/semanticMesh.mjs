/**
 * Small browser-native semantic layer adapted from the supplied
 * Generative-Morph-Chat prototype.
 *
 * It intentionally returns semantic material, not final prose.
 */
export const FIVE_W = Object.freeze(["who", "what", "where", "when", "why"]);

export const DIMENSION_BY_QUESTION = Object.freeze({
	who: "Space",
	what: "Movement",
	where: "Being",
	when: "Evolution",
	why: "Design",
});

const STOP_WORDS = new Set([
	"about", "after", "again", "also", "been", "being", "from", "have", "into",
	"more", "that", "their", "there", "these", "they", "this", "with", "your",
]);

const ROUTE_WORDS = Object.freeze({
	who: ["who", "person", "people", "character", "author", "speaker", "maker", "voice", "user"],
	what: ["what", "thing", "object", "action", "make", "edit", "build", "code", "source", "function"],
	where: ["where", "place", "location", "scene", "room", "world", "field", "file", "project"],
	when: ["when", "time", "before", "after", "sequence", "moment", "pace", "first", "history", "remember"],
	why: ["why", "because", "motive", "meaning", "purpose", "tension", "reason", "cause"],
});

export function tokenize(text) {
	return String(text)
		.toLowerCase()
		.replace(/[^a-z0-9\s_-]/g, " ")
		.split(/\s+/)
		.filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function buildCooccurrence(text, windowSize = 2) {
	const tokens = tokenize(text);
	const vectors = new Map();
	tokens.forEach((token, index) => {
		if (!vectors.has(token)) vectors.set(token, new Map());
		const vector = vectors.get(token);
		for (
			let cursor = Math.max(0, index - windowSize);
			cursor <= Math.min(tokens.length - 1, index + windowSize);
			cursor += 1
		) {
			if (cursor === index) continue;
			const context = tokens[cursor];
			vector.set(context, (vector.get(context) || 0) + 1);
		}
	});
	return { tokens, vectors };
}

function cosine(left, right) {
	const keys = new Set([...left.keys(), ...right.keys()]);
	let dot = 0;
	let magnitudeLeft = 0;
	let magnitudeRight = 0;
	keys.forEach((key) => {
		const a = left.get(key) || 0;
		const b = right.get(key) || 0;
		dot += a * b;
		magnitudeLeft += a * a;
		magnitudeRight += b * b;
	});
	if (!magnitudeLeft || !magnitudeRight) return 0;
	return dot / (Math.sqrt(magnitudeLeft) * Math.sqrt(magnitudeRight));
}

export function relatedTerms(text, seed, topN = 5) {
	const corpus = [
		"A person moves through a place and remembers what happened there.",
		"An object changes when pressure creates a new relation.",
		"A voice gives shape to an idea and a shape can carry meaning.",
		"Every edit changes structure, sequence, behavior, and purpose.",
		"Code connects inputs, state, functions, effects, outputs, and tests.",
		String(text),
	].join(" ");
	const { tokens, vectors } = buildCooccurrence(corpus);
	const selected = String(seed || tokens[0] || "").toLowerCase();
	const target = vectors.get(selected);
	if (!target) return [];
	return [...vectors.entries()]
		.filter(([word]) => word !== selected)
		.map(([word, vector]) => Object.freeze({
			word,
			similarity: cosine(target, vector),
		}))
		.sort((a, b) => b.similarity - a.similarity || a.word.localeCompare(b.word))
		.slice(0, topN);
}

export function routeQuestion(text) {
	const lower = String(text).toLowerCase();
	const ranked = FIVE_W
		.map((dimension) => Object.freeze({
			dimension,
			score: ROUTE_WORDS[dimension].reduce(
				(total, word) => total + (lower.includes(word) ? 1 : 0),
				0,
			),
		}))
		.sort((a, b) => b.score - a.score || FIVE_W.indexOf(a.dimension) - FIVE_W.indexOf(b.dimension));
	return ranked[0]?.score ? ranked[0].dimension : "what";
}

export function classifyIntent(text) {
	const lower = String(text).toLowerCase();
	if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(lower)) return "greeting";
	if (/\b(code|coding|function|class|javascript|typescript|python|html|css|bug|error|debug|refactor|api|script|program|compile|test)\b/.test(lower)) return "code";
	if (/\b(build|create|make|generate|synthesize)\b/.test(lower)) return "build";
	if (/\b(remember|earlier|before|last time|we said|you said)\b/.test(lower)) return "memory";
	if (/[?]\s*$/.test(lower) || /^(who|what|where|when|why|how|can|could|should|is|are|do|does)\b/.test(lower)) return "question";
	return "conversation";
}

export function semanticRead(text) {
	const tokens = tokenize(text);
	const focus = tokens[0] || "signal";
	const question = routeQuestion(text);
	return Object.freeze({
		focus,
		question,
		dimension: DIMENSION_BY_QUESTION[question],
		intent: classifyIntent(text),
		tokens: Object.freeze(tokens.slice(0, 12)),
		neighbors: Object.freeze(relatedTerms(text, focus)),
	});
}

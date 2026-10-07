function clean(value) {
	return String(value ?? "").trim();
}

function languageFrom(text) {
	const lower = text.toLowerCase();
	if (/\btypescript\b|\btsx\b/.test(lower)) return "typescript";
	if (/\bpython\b|\bpy\b/.test(lower)) return "python";
	if (/\bhtml\b/.test(lower)) return "html";
	if (/\bcss\b/.test(lower)) return "css";
	if (/\bjson\b/.test(lower)) return "json";
	return "javascript";
}

function codeTemplate(language, request) {
	const lower = request.toLowerCase();
	if (language === "python") {
		const name = /\b(add|sum)\b/.test(lower) ? "add" : "solve";
		const body = name === "add"
			? "return left + right"
			: "return value";
		const signature = name === "add"
			? `def ${name}(left: float, right: float) -> float:`
			: `def ${name}(value):`;
		return `${signature}\n    """Implement the requested transformation."""\n    ${body}`;
	}
	if (language === "html") {
		return '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>Morph Result</title>\n</head>\n<body>\n  <main id="app"></main>\n</body>\n</html>';
	}
	if (language === "css") {
		return ".component {\n  display: grid;\n  gap: 1rem;\n  min-width: 0;\n}";
	}
	if (language === "json") {
		return JSON.stringify({ request, status: "ready" }, null, 2);
	}
	if (/\b(add|sum)\b/.test(lower)) {
		return "export function add(left, right) {\n\treturn left + right;\n}";
	}
	if (/\bclass\b/.test(lower)) {
		return "export class Result {\n\tconstructor(value) {\n\t\tthis.value = value;\n\t}\n\n\ttoJSON() {\n\t\treturn { value: this.value };\n\t}\n}";
	}
	return "export function solve(input) {\n\tif (input === undefined || input === null) {\n\t\tthrow new TypeError(\"input is required\");\n\t}\n\treturn input;\n}";
}

function strongest(weights) {
	return [...weights].sort((a, b) => b.weight - a.weight)[0] || null;
}

function sentenceCase(value) {
	const text = clean(value);
	return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function summarizeOptionalMeshTools(meshTools) {
	if (!meshTools?.requested) return null;
	const completed = meshTools.results.filter((item) => item.status === "complete");
	const blocked = meshTools.results.filter((item) => item.status !== "complete");
	const notes = [];

	for (const item of completed) {
		const output = item.output || {};
		if (item.capability === "grammar.learn") {
			notes.push(
				`DEG learned ${output.ruleCount || 0} production rules from ${output.exampleCount || 0} examples`,
			);
		} else if (item.capability === "grammar.generate") {
			notes.push(
				`DEG generated a graph with ${output.graph?.nodes?.length || 0} nodes and ${output.applications?.length || 0} rule applications`,
			);
		} else if (item.capability === "grammar.snapshot") {
			notes.push(`DEG currently holds ${output.ruleCount || 0} production rules`);
		} else if (item.capability === "geometry.build") {
			notes.push(
				`Geo-DEG indexed ${output.nodeCount || 0} grammar nodes with ${output.edgeCount || 0} relational edges`,
			);
		} else if (item.capability === "geometry.neighbors") {
			notes.push(`Geo-DEG returned ${Array.isArray(output) ? output.length : 0} neighboring rules`);
		} else if (item.capability === "geometry.route") {
			notes.push(
				output.reachable
					? `Geo-DEG found a route across ${output.nodes?.length || 0} grammar nodes`
					: "Geo-DEG found no route between those rules",
			);
		} else if (item.capability === "geometry.compose") {
			notes.push(`Geo-DEG composed ${output.path?.length || 0} routed grammar nodes`);
		} else if (item.capability === "geometry.diffuse") {
			notes.push(`Geo-DEG diffused the signal for ${output.steps || 0} steps`);
		} else if (item.capability === "geometry.snapshot") {
			notes.push(
				`Geo-DEG currently holds ${output.nodeCount || 0} nodes and ${output.edgeCount || 0} edges`,
			);
		}
	}

	for (const item of blocked) {
		notes.push(item.error || `${item.capability} is not currently available`);
	}
	return notes.length ? `${notes.join(". ")}.` : null;
}

function compactOptionalMeshTools(meshTools) {
	if (!meshTools?.requested) return null;
	return meshTools.results.map((item) => {
		const output = item.output || {};
		return {
			status: item.status,
			capability: item.capability,
			automatonId: item.automatonId,
			error: item.error || null,
			summary: item.capability.startsWith("grammar.")
				? {
					exampleCount: output.exampleCount,
					ruleCount: output.ruleCount,
					nodeCount: output.graph?.nodes?.length,
					applications: output.applications?.length,
				}
				: {
					nodeCount: output.nodeCount,
					edgeCount: output.edgeCount,
					reachable: output.reachable,
					path: output.path || output.nodes,
					neighborCount: Array.isArray(output) ? output.length : undefined,
				},
		};
	});
}

/**
 * Dependency-free local realization. It is intentionally modest: the Morph
 * runtime owns cognition and this provider only turns response intent into
 * readable language.
 */
export class LocalMorphProvider {
	constructor() {
		this.id = "local-morph";
	}

	async generate(context) {
		const { text, semantic, perspective, history, codeAnalysis, meshTools } = context;
		const dominant = strongest(perspective.dimensions);
		const priorUser = [...history].reverse().find((message) => message.role === "user" && message.text !== text);
		const toolReply = summarizeOptionalMeshTools(meshTools);
		if (toolReply) {
			return `${toolReply} These were optional mesh calls: Morph requested capabilities, and the DEG/Geo-DEG automatons kept ownership of their own state.`;
		}

		if (semantic.intent === "greeting") {
			return "Hey. I’m here. We can talk normally, work through code, or open the Morph state and follow how the current idea is changing.";
		}

		if (semantic.intent === "code") {
			const language = languageFrom(text);
			const code = codeTemplate(language, text);
			const ambiguity = codeAnalysis?.ambiguous?.length
				? ` I also see lexical ambiguity around ${codeAnalysis.ambiguous.slice(0, 3).join(", ")}, so I would verify those names against the open project.`
				: "";
			return `I’m reading this primarily through ${dominant?.label || "Design"}: get the behavior correct first, then keep the interface small.${ambiguity}\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nThat is the local starting point. If a model provider is connected, I can expand this against the actual file context instead of guessing beyond what I can see.`;
		}

		if (semantic.intent === "memory" && priorUser) {
			return `I’m carrying the earlier thread forward. The prior user turn I still have in this session is “${String(priorUser.text).slice(0, 140)}”. From the current ${dominant?.label || "Evolution"} reading, I would treat the new message as a change to that trajectory rather than as a fresh conversation.`;
		}

		if (semantic.intent === "build") {
			return `I read this as a build request centered on “${semantic.focus}”. ${dominant?.label || "Design"} currently has the strongest proportion, so I would define the executable boundary first, keep the other automatons independent, and only then mount the result into the shared mesh.`;
		}

		const observations = perspective.observations
			.slice(0, 3)
			.map((item) => item.observation.replace(/\.$/, ""))
			.join("; ");
		const lead = semantic.intent === "question"
			? "My current reading is"
			: "I’m following you";
		return `${lead}: ${sentenceCase(observations)}. The proportions are not fixed; they will shift on the next turn if the position of the conversation changes.`;
	}
}

export class OpenAICompatibleProvider {
	constructor({
		endpoint,
		model,
		apiKey = "",
		fetchImpl = globalThis.fetch,
		allowNetwork = () => true,
	} = {}) {
		if (!endpoint) throw new TypeError("A model endpoint is required.");
		if (!model) throw new TypeError("A model name is required.");
		if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
		this.id = "openai-compatible";
		this.endpoint = endpoint.replace(/\/$/, "");
		this.model = model;
		this.apiKey = apiKey;
		this.fetchImpl = fetchImpl;
		this.allowNetwork = allowNetwork;
	}

	async generate(context) {
		if (!this.allowNetwork()) {
			throw new Error("Network generation is disabled by Synthia autonomy permissions.");
		}
		const weights = context.perspective.dimensions
			.map((item) => `${item.label}:${item.weight.toFixed(3)}`)
			.join(", ");
		const optionalToolMaterial = compactOptionalMeshTools(context.meshTools);
		const messages = [
			{
				role: "system",
				content: [
					"You are the language realization provider for Morph Chat.",
					"Speak naturally. Be capable at programming and ordinary conversation.",
					"Do not claim tool/file access you were not given.",
					"Keep perspectives plural rather than forcing one viewpoint.",
					`Current perspective proportions: ${weights}.`,
					optionalToolMaterial
						? `Optional mesh tool results: ${JSON.stringify(optionalToolMaterial)}`
						: "",
				].filter(Boolean).join(" "),
			},
			...context.history.slice(-16).map((message) => ({
				role: message.role === "assistant" ? "assistant" : "user",
				content: message.text,
			})),
		];
		const response = await this.fetchImpl(`${this.endpoint}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
			},
			body: JSON.stringify({
				model: this.model,
				messages,
				temperature: 0.7,
			}),
		});
		if (!response.ok) {
			throw new Error(`Model provider returned HTTP ${response.status}.`);
		}
		const payload = await response.json();
		const content = payload?.choices?.[0]?.message?.content;
		if (!clean(content)) throw new Error("Model provider returned no message.");
		return clean(content);
	}
}

/**
 * Optional mesh tool discovery for Morph Chat.
 *
 * Morph only knows capability contracts. DEG and Geo-DEG can be mounted,
 * removed, or replaced without Morph importing their implementations.
 */

const CAPABILITY_OPERATIONS = Object.freeze({
	"grammar.learn": "learn",
	"grammar.generate": "generate",
	"grammar.snapshot": "snapshot",
	"geometry.build": "build",
	"geometry.neighbors": "neighbors",
	"geometry.route": "route",
	"geometry.diffuse": "diffuse",
	"geometry.compose": "compose",
	"geometry.snapshot": "snapshot",
});

function capabilitiesOf(automaton) {
	const values = automaton?.metadata?.capabilities;
	return Array.isArray(values) ? values : [];
}

function asMesh(mesh) {
	if (!mesh || !(mesh.automatons instanceof Map)) {
		throw new TypeError("Optional Morph tools require an AutomataMesh-compatible object.");
	}
	return mesh;
}

function action(capability, payload = {}) {
	return Object.freeze({ capability, payload: Object.freeze({ ...payload }) });
}

function extractExamples(text) {
	const source = String(text);
	const marker = source.match(/\b(?:examples?|from)\s*:\s*([\s\S]+)$/i);
	const body = marker?.[1] || "";
	if (!body) return [];
	return body
		.split(/\s*(?:;|\n)\s*/)
		.map((item) => item.trim().replace(/^[-*]\s*/, ""))
		.filter((item) => item.length > 0);
}

function ruleIds(text) {
	return [...String(text).matchAll(/\bdeg-rule-\d+\b/gi)]
		.map((match) => match[0].toLowerCase());
}

/**
 * Turns ordinary-language requests into optional capability calls.
 *
 * This is intentionally conservative: Morph only reaches outside itself when
 * the user explicitly talks about grammar/DEG or geometry/Geo-DEG operations.
 */
export function planOptionalMeshTools(text) {
	const value = String(text || "");
	const lower = value.toLowerCase();
	const mentionsGrammar = /\b(?:deg|grammar|grammatical|motif|production rules?)\b/.test(lower);
	const mentionsGeometry = /\b(?:geo-deg|geometry|geometric|similarity|similar|neighbors?|reachability|route|routing|compose|composition|diffus(?:e|ion))\b/.test(lower);
	if (!mentionsGrammar && !mentionsGeometry) return Object.freeze([]);

	const actions = [];
	const examples = extractExamples(value);
	const wantsLearn = mentionsGrammar && /\b(?:learn|infer|extract|discover|train)\b/.test(lower);
	const wantsGenerate = mentionsGrammar && /\b(?:generate|synthesize|produce|sample)\b/.test(lower);
	const wantsBuildGeometry = mentionsGeometry && /\b(?:build|index|induce|create|make|construct|organize)\b/.test(lower);
	const wantsNeighbors = mentionsGeometry && /\bneighbors?\b/.test(lower);
	const wantsRoute = mentionsGeometry && /\b(?:route|routing|reachability|reachable|path)\b/.test(lower);
	const wantsCompose = mentionsGeometry && /\b(?:compose|composition)\b/.test(lower);
	const wantsDiffuse = mentionsGeometry && /\bdiffus(?:e|ion)\b/.test(lower);
	const ids = ruleIds(value);

	if (wantsLearn) actions.push(action("grammar.learn", { examples }));
	if (wantsGenerate) actions.push(action("grammar.generate", {}));

	if (wantsBuildGeometry) {
		actions.push(action("geometry.build", { useGrammarSnapshot: !wantsLearn }));
	}
	if (wantsNeighbors) {
		actions.push(action("geometry.neighbors", { id: ids[0] || null }));
	}
	if (wantsRoute) {
		actions.push(action("geometry.route", {
			from: ids[0] || null,
			to: ids[1] || null,
		}));
	}
	if (wantsCompose) {
		actions.push(action("geometry.compose", {
			from: ids[0] || null,
			to: ids[1] || null,
		}));
	}
	if (wantsDiffuse) {
		actions.push(action("geometry.diffuse", {
			id: ids[0] || null,
		}));
	}

	if (!actions.length && mentionsGeometry) actions.push(action("geometry.snapshot"));
	if (!actions.length && mentionsGrammar) actions.push(action("grammar.snapshot"));
	return Object.freeze(actions);
}

export class OptionalMeshTools {
	constructor({ meshes = [] } = {}) {
		this.meshes = new Set();
		for (const mesh of meshes) this.attach(mesh);
	}

	attach(mesh) {
		this.meshes.add(asMesh(mesh));
		return this;
	}

	detach(mesh) {
		this.meshes.delete(mesh);
		return this;
	}

	discover(capability = null) {
		const found = [];
		for (const mesh of this.meshes) {
			for (const automaton of mesh.automatons.values()) {
				const capabilities = capabilitiesOf(automaton);
				if (!capabilities.length) continue;
				if (capability && !capabilities.includes(capability)) continue;
				found.push(Object.freeze({
					id: automaton.id,
					capabilities: Object.freeze([...capabilities]),
					automaton,
					mesh,
				}));
			}
		}
		return Object.freeze(found);
	}

	has(capability) {
		return this.discover(capability).length > 0;
	}

	async invoke(capability, payload = {}) {
		const target = this.discover(capability)[0];
		if (!target) {
			return Object.freeze({
				status: "unavailable",
				capability,
				automatonId: null,
				output: null,
			});
		}
		const operation = CAPABILITY_OPERATIONS[capability];
		if (!operation) {
			throw new RangeError(`Unknown optional Morph capability: ${capability}`);
		}
		try {
			const output = await target.automaton.call(
				{ op: operation, ...payload },
				{
					source: "morph-chat",
					capability,
					optional: true,
				},
			);
			return Object.freeze({
				status: "complete",
				capability,
				automatonId: target.automaton.id,
				output,
			});
		} catch (error) {
			return Object.freeze({
				status: "failed",
				capability,
				automatonId: target.automaton.id,
				error: error instanceof Error ? error.message : String(error),
				output: null,
			});
		}
	}

	async run(text) {
		const plan = planOptionalMeshTools(text);
		if (!plan.length) {
			return Object.freeze({
				requested: false,
				plan,
				results: Object.freeze([]),
			});
		}

		const results = [];
		let learnedGrammar = null;
		for (const step of plan) {
			if (step.capability === "grammar.learn" && step.payload.examples.length === 0) {
				results.push(Object.freeze({
					status: "needs-input",
					capability: step.capability,
					automatonId: null,
					error: "Give examples after `examples:` or `from:` separated by semicolons or new lines.",
					output: null,
				}));
				continue;
			}

			let payload = { ...step.payload };
			if (step.capability === "geometry.build") {
				if (learnedGrammar) {
					payload = { grammar: learnedGrammar };
				} else {
					const snapshot = await this.invoke("grammar.snapshot");
					if (snapshot.status !== "complete" || !snapshot.output?.ruleCount) {
						results.push(Object.freeze({
							status: "needs-input",
							capability: step.capability,
							automatonId: null,
							error: "Geo-DEG needs a learned production grammar before geometry can be built.",
							output: null,
						}));
						continue;
					}
					payload = { grammar: snapshot.output };
				}
			}

			if (step.capability === "geometry.neighbors" && !payload.id) {
				results.push(Object.freeze({
					status: "needs-input",
					capability: step.capability,
					automatonId: null,
					error: "Name a rule such as deg-rule-1.",
					output: null,
				}));
				continue;
			}

			if (step.capability === "geometry.route" && (!payload.from || !payload.to)) {
				results.push(Object.freeze({
					status: "needs-input",
					capability: step.capability,
					automatonId: null,
					error: "Name two rule ids, for example deg-rule-1 and deg-rule-2.",
					output: null,
				}));
				continue;
			}

			if (step.capability === "geometry.compose") {
				if (!payload.from || !payload.to) {
					results.push(Object.freeze({
						status: "needs-input",
						capability: step.capability,
						automatonId: null,
						error: "Composition needs two rule ids so Morph can obtain a route first.",
						output: null,
					}));
					continue;
				}
				const routed = await this.invoke("geometry.route", {
					from: payload.from,
					to: payload.to,
				});
				results.push(routed);
				if (routed.status !== "complete" || !routed.output?.reachable) continue;
				payload = { route: routed.output };
			}

			if (step.capability === "geometry.diffuse") {
				if (!payload.id) {
					results.push(Object.freeze({
						status: "needs-input",
						capability: step.capability,
						automatonId: null,
						error: "Diffusion needs a starting rule id such as deg-rule-1.",
						output: null,
					}));
					continue;
				}
				payload = {
					signal: { [payload.id]: 1 },
					options: { steps: 3 },
				};
			}

			delete payload.useGrammarSnapshot;
			const result = await this.invoke(step.capability, payload);
			results.push(result);
			if (step.capability === "grammar.learn" && result.status === "complete") {
				learnedGrammar = result.output;
			}
		}

		return Object.freeze({
			requested: true,
			plan,
			results: Object.freeze(results),
		});
	}

	snapshot() {
		const tools = this.discover().map(({ id, capabilities }) => Object.freeze({
			id,
			capabilities,
		}));
		return Object.freeze({
			kind: "synthia.morph.optional-mesh-tools.v1",
			meshCount: this.meshes.size,
			tools: Object.freeze(tools),
		});
	}
}


function cleanText(value) {
	return String(value ?? "").trim();
}

function freeze(value) {
	return Object.freeze(value);
}

function addressValue(address, key) {
	const value = address?.[key];
	return value === undefined ? null : value;
}

export class GenericDomainAdapter {
	constructor({ lexicon }) {
		this.id = "generic";
		this.lexicon = lexicon;
	}

	translate(input, {
		address = {},
		context = {},
		primitive = null,
	} = {}) {
		const text = cleanText(typeof input === "string" ? input : input?.text || input?.input);
		const resolvedPrimitive =
			primitive ||
			this.lexicon.find(context.primitiveHint) ||
			this.lexicon.find(text);
		return freeze({
			domain: context.domain || "generic",
			primitive: resolvedPrimitive,
			positions: freeze({
				P: resolvedPrimitive
					? { id: resolvedPrimitive.id, name: resolvedPrimitive.name }
					: null,
				D: address.dimension || address.planetaryDimension || context.dimension || null,
				G: addressValue(address, "gate"),
				L: addressValue(address, "line"),
				C: addressValue(address, "color"),
				T: addressValue(address, "tone"),
				B: addressValue(address, "base"),
			}),
			positionLabels: freeze({
				P: "source / primitive",
				D: "domain / dimension",
				G: "semantic state",
				L: "expression / behavior",
				C: "motivation / constraint",
				T: "perception / sense",
				B: "underlying orientation",
			}),
			source: freeze({
				text,
				structured:
					typeof input === "object" && input !== null
						? structuredClone(input)
						: null,
			}),
			context: freeze({ ...context }),
		});
	}
}

export class HumanDesignDomainAdapter extends GenericDomainAdapter {
	constructor(options) {
		super(options);
		this.id = "human-design";
	}

	translate(input, options = {}) {
		const generic = super.translate(input, options);
		const address = options.address || {};
		const primitive =
			this.lexicon.get(address.gate) ||
			generic.primitive;

		return freeze({
			...generic,
			domain: "human-design",
			primitive,
			positions: freeze({
				P: primitive
					? {
						id: primitive.id,
						name: primitive.name,
						sourcePlanet:
							options.context?.planet ||
							options.context?.sourcePlanet ||
							null,
					}
					: null,
				D:
					address.dimension ||
					address.planetaryDimension ||
					options.context?.dimension ||
					null,
				G: addressValue(address, "gate"),
				L: addressValue(address, "line"),
				C: addressValue(address, "color"),
				T: addressValue(address, "tone"),
				B: addressValue(address, "base"),
			}),
			positionLabels: freeze({
				P: "source / primitive",
				D: "dimension",
				G: "gate / semantic state",
				L: "line / expression",
				C: "color / motivation-constraint",
				T: "tone / perception-sense",
				B: "base / underlying orientation",
			}),
		});
	}
}

export class CodeDomainAdapter extends GenericDomainAdapter {
	constructor(options) {
		super(options);
		this.id = "code";
	}

	translate(input, options = {}) {
		const generic = super.translate(input, options);
		const context = options.context || {};
		const source =
			context.file ||
			context.component ||
			context.project ||
			null;
		return freeze({
			...generic,
			domain: "code",
			positions: freeze({
				P:
					generic.primitive
						? {
							id: generic.primitive.id,
							name: generic.primitive.name,
							source,
						}
						: source,
				D: context.language || context.domain || "code",
				G: context.state || addressValue(options.address || {}, "gate"),
				L: context.behavior || context.expression || addressValue(options.address || {}, "line"),
				C: context.constraint || addressValue(options.address || {}, "color"),
				T: context.inputMode || context.perception || addressValue(options.address || {}, "tone"),
				B: context.ground || context.runtime || addressValue(options.address || {}, "base"),
			}),
			positionLabels: freeze({
				P: "source / primitive",
				D: "code domain",
				G: "program state",
				L: "runtime behavior",
				C: "constraint",
				T: "input / observation",
				B: "runtime ground",
			}),
		});
	}
}


export class LanguageDomainAdapter extends GenericDomainAdapter {
	constructor(options) {
		super(options);
		this.id = "language";
	}

	translate(input, options = {}) {
		const generic = super.translate(input, options);
		const context = options.context || {};
		const linguistic = context.linguistic || null;
		return freeze({
			...generic,
			domain: "language",
			positions: freeze({
				P: generic.primitive
					? {
						id: generic.primitive.id,
						name: generic.primitive.name,
					}
					: null,
				D: context.language || "language",
				G: context.semanticState || addressValue(options.address || {}, "gate"),
				L:
					context.expression ||
					linguistic?.pipeline?.parseTree?.root ||
					addressValue(options.address || {}, "line"),
				C:
					context.constraint ||
					linguistic?.pipeline?.phraseStructure?.newRules?.length ||
					addressValue(options.address || {}, "color"),
				T:
					context.perception ||
					"linguistic-input",
				B:
					context.ground ||
					linguistic?.pipeline?.frame ||
					addressValue(options.address || {}, "base"),
			}),
			positionLabels: freeze({
				P: "source / primitive",
				D: "language domain",
				G: "semantic state",
				L: "expression / grammatical behavior",
				C: "constraint / grammar",
				T: "linguistic perception",
				B: "underlying grammatical orientation",
			}),
		});
	}
}

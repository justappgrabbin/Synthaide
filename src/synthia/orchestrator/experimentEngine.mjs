
function freezeRecord(value) {
	return Object.freeze(structuredClone(value));
}

export class Variable {
	constructor({
		id,
		value = null,
		readable = true,
		writable = true,
		validate = () => true,
	} = {}) {
		if (!id) throw new TypeError("Variable requires an id.");
		this.id = String(id);
		this.value = value;
		this.readable = Boolean(readable);
		this.writable = Boolean(writable);
		this.validate = validate;
	}

	read() {
		if (!this.readable) throw new Error(`Variable ${this.id} is not readable.`);
		return structuredClone(this.value);
	}

	write(value) {
		if (!this.writable) throw new Error(`Variable ${this.id} is not writable.`);
		if (!this.validate(value)) throw new TypeError(`Invalid value for ${this.id}.`);
		this.value = structuredClone(value);
		return this.read();
	}
}

export class Action {
	constructor({ id, run, metadata = {} } = {}) {
		if (!id || typeof run !== "function") {
			throw new TypeError("Action requires id and run(input, context).");
		}
		this.id = String(id);
		this.run = run;
		this.metadata = freezeRecord(metadata);
	}
}

export class ExperimentModule {
	constructor({ id, variables = [], actions = [] } = {}) {
		if (!id) throw new TypeError("ExperimentModule requires an id.");
		this.id = String(id);
		this.variables = new Map();
		this.actions = new Map();
		for (const variable of variables) this.addVariable(variable);
		for (const action of actions) this.addAction(action);
	}

	addVariable(variable) {
		const instance = variable instanceof Variable ? variable : new Variable(variable);
		if (this.variables.has(instance.id)) throw new Error(`Duplicate variable: ${instance.id}`);
		this.variables.set(instance.id, instance);
		return instance;
	}

	addAction(action) {
		const instance = action instanceof Action ? action : new Action(action);
		if (this.actions.has(instance.id)) throw new Error(`Duplicate action: ${instance.id}`);
		this.actions.set(instance.id, instance);
		return instance;
	}

	read(id) {
		const variable = this.variables.get(String(id));
		if (!variable) throw new RangeError(`Unknown variable: ${id}`);
		return variable.read();
	}

	write(id, value) {
		const variable = this.variables.get(String(id));
		if (!variable) throw new RangeError(`Unknown variable: ${id}`);
		return variable.write(value);
	}

	async invoke(actionId, input, context = {}) {
		const action = this.actions.get(String(actionId));
		if (!action) throw new RangeError(`Unknown action: ${actionId}`);
		return action.run(input, Object.freeze({
			module: this,
			context,
		}));
	}

	manifest() {
		return Object.freeze({
			id: this.id,
			variables: Object.freeze([...this.variables.keys()].sort()),
			actions: Object.freeze([...this.actions.keys()].sort()),
		});
	}
}

export class ExperimentEngine {
	constructor() {
		this.modules = new Map();
		this.runs = [];
	}

	register(module) {
		const instance = module instanceof ExperimentModule
			? module
			: new ExperimentModule(module);
		if (this.modules.has(instance.id)) {
			throw new Error(`Duplicate experiment module: ${instance.id}`);
		}
		this.modules.set(instance.id, instance);
		return instance;
	}

	async runRecipe(recipe, context = {}) {
		if (!recipe?.id || !Array.isArray(recipe.steps)) {
			throw new TypeError("Recipe requires id and steps.");
		}
		const outputs = [];
		for (let index = 0; index < recipe.steps.length; index += 1) {
			const step = recipe.steps[index];
			const module = this.modules.get(String(step.moduleId));
			if (!module) throw new RangeError(`Unknown recipe module: ${step.moduleId}`);
			const output = await module.invoke(step.actionId, step.input, {
				...context,
				step,
				index,
				outputs: Object.freeze([...outputs]),
			});
			outputs.push(freezeRecord({
				step: index + 1,
				moduleId: module.id,
				actionId: step.actionId,
				output,
			}));
		}
		const run = freezeRecord({
			id: `experiment-${this.runs.length + 1}`,
			recipeId: recipe.id,
			outputs,
			at: new Date().toISOString(),
		});
		this.runs.push(run);
		return run;
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.experiment-engine.v1",
			modules: Object.freeze([...this.modules.values()].map((module) => module.manifest())),
			runs: Object.freeze([...this.runs]),
		});
	}
}

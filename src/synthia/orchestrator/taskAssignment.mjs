
function asSet(values) {
	return new Set((values || []).map(String));
}

function capabilityFit(worker, capability) {
	return asSet(worker.capabilities).has(String(capability)) ? 1 : 0;
}

function cloneWorker(worker) {
	return {
		id: String(worker.id),
		capabilities: [...(worker.capabilities || [])].map(String),
		status: worker.status || "available",
		location: worker.location ?? null,
		meta: structuredClone(worker.meta || {}),
	};
}

export class TaskAssignmentEngine {
	constructor({ stallLimit = 3 } = {}) {
		this.stallLimit = stallLimit;
		this.workers = new Map();
		this.assignments = new Map();
		this.reservations = new Map();
		this.events = [];
	}

	registerWorkers(workers = []) {
		for (const worker of workers) {
			if (!worker?.id) throw new TypeError("Every worker requires an id.");
			this.workers.set(String(worker.id), cloneWorker(worker));
		}
		return this.snapshot();
	}

	clearWorkers() {
		this.workers.clear();
		this.assignments.clear();
		this.reservations.clear();
	}

	#candidateWorkers(task) {
		return [...this.workers.values()]
			.filter((worker) => worker.status === "available")
			.filter((worker) => capabilityFit(worker, task.capability))
			.sort((left, right) => {
				const leftLoad = [...this.assignments.values()].filter(
					(assignment) => assignment.workerId === left.id && assignment.status === "assigned",
				).length;
				const rightLoad = [...this.assignments.values()].filter(
					(assignment) => assignment.workerId === right.id && assignment.status === "assigned",
				).length;
				return leftLoad - rightLoad || left.id.localeCompare(right.id);
			});
	}

	assign(tasks = []) {
		const assigned = [];
		const pending = [];
		for (const task of tasks) {
			if (!task?.id || !task?.capability) {
				throw new TypeError("Each task requires id and capability.");
			}
			const worker = this.#candidateWorkers(task)[0];
			if (!worker) {
				pending.push(Object.freeze({
					task: Object.freeze(structuredClone(task)),
					reason: "NO_COMPATIBLE_WORKER",
				}));
				continue;
			}
			const reservationKey = task.resource ?? task.target ?? null;
			if (
				reservationKey !== null &&
				this.reservations.has(String(reservationKey))
			) {
				pending.push(Object.freeze({
					task: Object.freeze(structuredClone(task)),
					reason: "RESOURCE_COLLISION",
				}));
				continue;
			}
			const assignment = {
				id: `assignment-${this.assignments.size + 1}`,
				taskId: String(task.id),
				workerId: worker.id,
				capability: String(task.capability),
				status: "assigned",
				stallTicks: 0,
				resource: reservationKey,
				task: structuredClone(task),
			};
			this.assignments.set(assignment.id, assignment);
			if (reservationKey !== null) {
				this.reservations.set(String(reservationKey), assignment.id);
			}
			assigned.push(Object.freeze(structuredClone(assignment)));
		}
		const result = Object.freeze({
			assigned: Object.freeze(assigned),
			pending: Object.freeze(pending),
		});
		this.events.push(Object.freeze({ type: "assign", result }));
		return result;
	}

	complete(assignmentId, output = null) {
		const assignment = this.assignments.get(String(assignmentId));
		if (!assignment) throw new RangeError(`Unknown assignment: ${assignmentId}`);
		assignment.status = "complete";
		assignment.output = output;
		if (assignment.resource !== null) {
			this.reservations.delete(String(assignment.resource));
		}
		this.events.push(Object.freeze({
			type: "complete",
			assignmentId: assignment.id,
		}));
		return Object.freeze(structuredClone(assignment));
	}

	release(assignmentId, reason = "released") {
		const assignment = this.assignments.get(String(assignmentId));
		if (!assignment) throw new RangeError(`Unknown assignment: ${assignmentId}`);
		assignment.status = "released";
		assignment.reason = String(reason);
		if (assignment.resource !== null) {
			this.reservations.delete(String(assignment.resource));
		}
		this.events.push(Object.freeze({
			type: "release",
			assignmentId: assignment.id,
			reason: assignment.reason,
		}));
		return Object.freeze(structuredClone(assignment));
	}

	tick(blockedAssignmentIds = []) {
		const blocked = new Set(blockedAssignmentIds.map(String));
		const released = [];
		for (const assignment of this.assignments.values()) {
			if (assignment.status !== "assigned") continue;
			if (!blocked.has(assignment.id)) {
				assignment.stallTicks = 0;
				continue;
			}
			assignment.stallTicks += 1;
			if (assignment.stallTicks >= this.stallLimit) {
				released.push(this.release(assignment.id, "STALL_LIMIT"));
			}
		}
		return Object.freeze(released);
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.task-assignment.v1",
			workers: Object.freeze([...this.workers.values()].map((worker) => (
				Object.freeze(structuredClone(worker))
			))),
			assignments: Object.freeze([...this.assignments.values()].map((item) => (
				Object.freeze(structuredClone(item))
			))),
			reservations: Object.freeze(Object.fromEntries(this.reservations)),
			events: Object.freeze([...this.events]),
		});
	}
}

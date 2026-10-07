import { StateSpaceKernel } from "../ato-core/state-space-kernel.mjs";
import {
	canonicalAddress,
	gateState,
	normalizeAddress,
} from "../ato-core/address-space.mjs";
import {
	relation as gateRelation,
	shortestPath,
} from "../ato-core/iching.mjs";
import {
	locateHexagram,
	transformHouse,
} from "../ato-core/klein-iching.mjs";

const NESTED_FIELDS = Object.freeze(["gate", "line", "color", "tone", "base"]);

function clone(value) {
	return value == null ? value : structuredClone(value);
}

function macro(address) {
	if (!address) return null;
	return normalizeAddress({
		mode: "macro",
		gate: address.gate,
		line: address.line,
		color: address.color,
		tone: address.tone,
		base: address.base,
	});
}

function lineBit(bits, line) {
	const index = 6 - line;
	return Number(bits[index]);
}

function nestedDelta(source, target) {
	return Object.freeze(
		NESTED_FIELDS.map((field) => Object.freeze({
			field,
			from: source[field],
			to: target[field],
			changed: source[field] !== target[field],
		})),
	);
}

/**
 * Reuses Synthia's existing address-space, state-space, I Ching, and
 * Klein eight-house calculations. No new symbolic meanings are invented here.
 */
export class KleinAddressCalculator {
	constructor({ kernel = new StateSpaceKernel() } = {}) {
		this.id = "synthia-klein-address-calculator";
		this.kernel = kernel;
	}

	describe(address) {
		const position = macro(address);
		if (!position) return null;

		const gate = gateState(position);
		const vector = this.kernel.vector(position);
		const house = locateHexagram(gate.bits);

		return Object.freeze({
			address: position,
			addressKey: canonicalAddress(position),
			gate: Object.freeze({
				number: position.gate,
				bits: gate.bits,
				index: gate.index,
			}),
			line: Object.freeze({
				number: position.line,
				bit: lineBit(gate.bits, position.line),
				bitIndexTopDown: 6 - position.line,
			}),
			color: position.color,
			tone: position.tone,
			base: position.base,
			vector,
			kleinHouse: clone(house),
		});
	}

	calculate(sourceAddress, targetAddress = null) {
		const source = this.describe(sourceAddress);
		if (!source) return null;

		const target = this.describe(targetAddress || sourceAddress);
		const gatePath = shortestPath(source.gate.bits, target.gate.bits);
		const gateOp = gateRelation(source.gate.bits, target.gate.bits, "equivalence");
		const houseTransform = transformHouse(
			source.kleinHouse.houseId,
			target.kleinHouse.houseId,
		);
		const vectorTransform = this.kernel.transform(
			source.address,
			target.address,
			"equivalence",
		);

		return Object.freeze({
			version: "synthia.klein-address-calculation.v1",
			source,
			target,
			nested: Object.freeze({
				order: NESTED_FIELDS,
				delta: nestedDelta(source.address, target.address),
			}),
			transition: Object.freeze({
				gateChangingLines: gatePath.changingLines,
				gateDistance: gatePath.distance,
				gateOperator: gateOp.bits,
				kleinHouseOperator: houseTransform.operator,
				kleinHouseTransformValid: houseTransform.valid,
				vectorOperator: vectorTransform.vector,
			}),
		});
	}

	snapshot() {
		return Object.freeze({
			version: "synthia.klein-address-calculator.v1",
			nestedOrder: NESTED_FIELDS,
			featureWidth: this.kernel.featureWidth,
		});
	}
}

export default KleinAddressCalculator;

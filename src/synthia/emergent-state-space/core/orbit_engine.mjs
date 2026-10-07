// orbit_engine.mjs
//
// "Make the state space emergent, like a calculator" — this is that, built
// from what's already real here rather than a disconnected new toy: each
// gate has three real, already-verified relations (inverse/reverse/nuclear,
// same ones organism.html already uses as real Cortex edge weights). A
// "direction" is one of those three relations. An orbit is what you get by
// repeatedly applying a direction from a starting gate — no training, no
// hand-authored destination, the trajectory is computed step by step until
// it hits a fixed point or a repeat (an attractor, in the same sense the
// pasted string-rewriting example used the word), exactly the "iterate
// local rules to a stable state" pattern, just over real hexagram structure
// instead of unary tally marks.

import { makeGateRelations } from './gate_relations.mjs';

export function makeOrbitEngine(gateTable) {
  const { gateInverse, gateReverse, gateNuclear } = makeGateRelations(gateTable);
  const DIRECTIONS = { inverse: gateInverse, reverse: gateReverse, nuclear: gateNuclear };

  // Real, computed (not asserted) step trace — mirrors the pasted example's
  // "Step 0 / Step 1 / ... System Stabilized" format.
  function orbit(startGate, direction, maxSteps = 20) {
    const fn = DIRECTIONS[direction];
    if (!fn) throw new Error(`Unknown direction: ${direction}. Known: ${Object.keys(DIRECTIONS).join(', ')}`);
    const trace = [startGate];
    const seen = new Map([[startGate, 0]]);
    let current = startGate;
    for (let step = 1; step <= maxSteps; step++) {
      const next = fn(current);
      trace.push(next);
      if (next === current) {
        return { trace, outcome: 'fixed-point', period: 0, steps: step };
      }
      if (seen.has(next)) {
        return { trace, outcome: 'cycle', period: step - seen.get(next), cycleStartStep: seen.get(next), steps: step };
      }
      seen.set(next, step);
      current = next;
    }
    return { trace, outcome: 'max-steps-reached', steps: maxSteps };
  }

  // A real multi-direction walk: apply a SEQUENCE of directions in order
  // (e.g. ['reverse','nuclear','inverse']) — this is where "directions"
  // becomes genuinely emergent rather than single-relation-repeated: the
  // path depends on the real structural consequence of each step, not a
  // fixed lookup.
  function walk(startGate, directionSequence) {
    const trace = [startGate];
    let current = startGate;
    for (const dir of directionSequence) {
      const fn = DIRECTIONS[dir];
      if (!fn) throw new Error(`Unknown direction: ${dir}`);
      current = fn(current);
      trace.push(current);
    }
    return trace;
  }

  return { orbit, walk, DIRECTIONS: Object.keys(DIRECTIONS) };
}

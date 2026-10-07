# Generative Experiment Orchestrator

## Purpose

A single coordinating ATO that builds and searches an execution process without taking ownership of the independent automatons it uses.

## Runtime path

```text
GOAL
  ↓
ATO StateSpaceKernel
  ↓
DEG capability (optional external automaton)
  ↓
Geo-DEG capability (optional external automaton)
  ↓
MicroStateSpace
  ↓
CompositionPredictor
  ↓
ExplorationController
  ↓
PUCT
  ↓
TaskAssignmentEngine
  ↓
ExperimentEngine
  ↓
execute
  ↓
score / accept
  ↓
predictor + Q/policy update
```

## Modules

- `orchestrator/microStateSpace.mjs`
  - explicit states and legal transitions
  - PUCT
  - bounded alpha-beta/negamax tactical search
  - Q/policy tables
  - self-play
  - serialization

- `orchestrator/compositionPredictor.mjs`
  - small dependency-free neural estimator
  - predicts quality and cost before execution
  - updates from measured outcomes

- `orchestrator/explorationController.mjs`
  - exploitation
  - uncertainty-directed exploration
  - novelty exploration
  - bounded value-free exploration

- `orchestrator/taskAssignment.mjs`
  - worker capability matching
  - resource reservations/collision detection
  - stall release

- `orchestrator/experimentEngine.mjs`
  - Variable
  - Action
  - ExperimentModule
  - Recipe execution

- `orchestrator/capabilityBroker.mjs`
  - discovers external automatons by declared capabilities
  - no direct DEG/Geo-DEG implementation import

## Clean-room boundary

OmniBoost is AGPL-3.0. This project does not copy OmniBoost source. The local predictor/search code is a clean implementation of the architectural idea described by the paper/repository: performance estimation before MCTS configuration search.

## Tests

Run:

```bash
npm run test:synthia-orchestrator
npm run test:synthia-all
```

# Organism 20 governed integration

The useful mechanisms from `organism-20.html` were translated into Cynthia's existing architecture rather than installing a second brain.

Integrated:

- bounded organism pulse, independent from visual frame rate;
- metabolism and circadian phase;
- capped episodic memory with gate evidence;
- deduplicated action proposals;
- non-overwritable approval gate;
- serializable deterministic organism state.

Not imported because Cynthia already has stronger native organs:

- separate 64-neuron cortex;
- duplicate StateSpace and ToolFactory;
- duplicate AutoLing, semantic mesh, and orchestrator;
- iframe/browser UI and donor-specific presentation code.

The original defect allowed every animation frame to reconsider work while approval was pending. Cynthia's integrated organism now treats pending approval and active work as hard decision locks.

# Synthia VQ-VAE Trigger Test

## Purpose

This checkpoint verifies the compact firing mechanism directly:

`cue -> VQ-VAE discrete trace -> learned trace binding -> ATO fires -> Integrated Tool Factory -> executable synthesized tool -> semantic completion`

The test is intentionally separate from any UI.

## Verification

Run:

```bash
npm run test:synthia-vqvae
```

Expected: **5/5 pass**.

Run the active device-core verification:

```bash
npm run test:synthia-device-core
```

Expected:

- active Synthia spine: 38/38
- Living Mesh: 7/7
- Neural Mesh: 8/8
- VQ-VAE trigger: 5/5

Total active device-core checks: **58/58**.

## Compactness

The current VQ-VAE + semantic-completion models contain fewer than 40,000 numeric parameters total.
At Float64 storage that is under 320 KiB of raw numeric weights.

The trace is a compact firing identity. The original cue remains the operational payload.

## Sparse firing

An unbound trace fires nothing.

A trace activates an Automaton only after that trace has a learned binding.

## Tool emergence test

The verification binds one cue to a small ATO that delegates to the currently active Integrated Tool Factory.
The test proves the resulting generated tool is mounted and executable.

# Dataset provenance — DimensionRouter vocabulary expansion (v1.3.0)

## What changed
`DimensionRouter`'s five `terms` seed lists (previously 9-10 hand-picked words each) were
expanded with real, empirically-derived vocabulary. Nothing else in the module changed —
still zero imports, zero network, zero `eval`/`new Function`, browser-compatible. The
dataset was used **offline, once, to generate a bigger static array**, not wired in as a
runtime dependency.

## Source dataset — actually downloaded and verified, not assumed
[GoEmotions](https://huggingface.co/datasets/google-research-datasets/go_emotions)
(`google-research-datasets/go_emotions`, raw config), pulled 2026-08-10 via the `datasets`
library: **211,225 real annotated rows**, 27 emotion categories + neutral, license
**Apache-2.0** — confirmed directly from the dataset card, safe for commercial use.

Two other datasets came up earlier in this conversation and were deliberately **not**
used here:
- **DailyDialog** — real, but licensed **CC BY-NC-SA 4.0** (non-commercial, share-alike).
- **EmpatheticDialogues** — real, but licensed **CC BY-NC 4.0** (non-commercial).

Both are fine for research/prototyping but not for a product meant to be commercial —
worth keeping in mind if either gets pulled in later for a different subsystem.

## Method — real, reproducible, not a black box
For each of the 27 real GoEmotions categories, computed word-vs-corpus **log-odds** over
the actual 211k rows (word frequency inside comments carrying that label, vs. background
frequency across the whole corpus; minimum-support thresholds applied to cut noise), took
the top-ranked real words per category.

## Mapping onto the 5 dimensions — Claude's own reasoned synthesis, flagged as such
The 27 GoEmotions categories are **not** part of the JUT/Human-Design source material this
project's dimension chains come from — there is no existing "correct" answer to map
against. This mapping is an editorial judgment call, made to be inspectable and easy to
revise, not a verified correspondence:

- **Movement** (Energy/Creation/Seeing — kinetic, activating): desire, excitement, fear,
  surprise, nervousness, anger
- **Evolution** (Gravity/Memory/Taste/Love — relational, across time): love, admiration,
  gratitude, grief, pride, optimism, caring
- **Being** (Matter/Touch/Sex/Survival — immediate embodied state): joy, sadness, disgust,
  embarrassment, amusement, relief
- **Design** (Structure/Progress/Life/Art — evaluating/building/correcting): approval,
  disapproval, disappointment, annoyance, confusion, curiosity, realization, remorse
- **Space** — deliberately given nothing from this dataset. Matches the already-established
  source-text principle that Space "does not play a part in these formulae" — it's the
  emergent dimension, not a fifth bucket to force categories into. `neutral` was excluded
  for the same reason (and its own log-odds words were mostly noise — a residual category
  has no real lexical signature).

## Cleanup applied on top of the real computed ranks
Manually dropped: apostrophe-bearing tokens (broke JS string literals), profanity/slurs
surfaced by real Reddit text, and a handful of proper nouns / platform artifacts
(subreddit names, "cakeday", etc.) that were real log-odds hits but not generalizable
signal. This is editorial curation layered on top of real data, not itself verified —
worth spot-checking the arrays in `src/integrated-tool-factory.mjs` directly.

## Verification actually performed
- `node --check` clean.
- Full suite re-run with the real `ato-core` (from `ato-mcp-v0_1-fixed.zip`) placed at the
  path `test/ato-native-bridge.test.mjs` expects: **11/11 passing**, including the native
  ATO-mounting tests (the original zip's own bundled test suite was 8/9 — the 9th file
  fails standalone because it expects a sibling `ato-core-native-test/` directory that
  wasn't included in this zip; that's a packaging gap, not a bug in this module).
- Real before/after routing comparison (not asserted — actually run against both the
  original and patched files): 4 real sentences using words nowhere in the original 9-word
  seed lists ("terrified", "anxious", "grateful", "proud", "disgusting", "embarrassing",
  "confused", "disappointed") — 3 of 4 came back `unresolved` (`NO_DIMENSION_MATCH`)
  against the original file, all 4 resolve correctly against the patched file.

## Honest limits
- Log-odds on Reddit text is a blunt instrument — some remaining words in the arrays are
  weaker signal than others (e.g. "battle", "adventure" under Movement) even after cleanup.
- The category→dimension mapping is a first pass, not user-confirmed. Easy to re-run
  `analyze.py`/`merge.py` (not shipped in this zip — ask if you want the pipeline itself
  delivered, not just the output) with a different mapping if any of it looks wrong once
  you see it working on real conversation text.
- This only touched `DimensionRouter`'s vocabulary. `PurposePlanner`'s `LEVEL_CUES` (which
  picks the 0-7 structural level) still has its original tiny per-level word lists —
  same kind of gap, not addressed this pass.

## v1.4.0 addition: each dimension's own real seed-gate vocabulary
On top of the GoEmotions layer (v1.3.0), each dimension now also carries real vocabulary
from its OWN already-assigned seed gate, pulled directly from Bradford Hatcher's *Yijing,
Word By Word* (Key Words + Glossary sections, extracted and verified against the actual
uploaded 1100-page book): Movement = Gate 1 (Qian, "Creating"), Evolution = Gate 2 (Kun,
"Accepting"), Being = Gate 6 (Song, "Contention"), Design = Gate 14 (Da You, "Big Domain"),
Space = Gate 20 (Guan, "Perspective"). This is more directly authoritative than the
GoEmotions mapping -- it isn't an inferred correspondence, it's this project's own
already-established gate-to-dimension assignment.

**Real bug found and fixed through testing, not assumed clean:** after merging, a real
test sentence ("she needs sovereignty and command over her own vocation" -- built from
Gate 1's own real vocabulary) incorrectly routed to Design instead of Movement. Traced
the cause precisely: generic function words ("over", "her", "own", "very", "has", "into",
etc. -- 16 total across all 5 dimensions) had slipped through the v1.3.0 GoEmotions
stopword filter and were diluting the router with false-positive matches carrying no real
dimensional signal. Removed them (keeping each dimension's own deliberate interrogative
seed word -- where/what/when/why/who -- those are intentional, not contamination). Re-ran
all 5 real test sentences after the fix: 5/5 now resolve to their intended dimension,
11/11 tests still pass.

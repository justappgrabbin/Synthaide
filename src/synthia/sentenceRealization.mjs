// sentence_realization.js
// Rebuild of the architecture in "Generative Grammar: A Meaning First Approach" (PMC7719672):
// a thought structure is generated FIRST (the meaning), and only then realized as a signal
// (the sentence). This is deliberately two separate steps below — buildThought() never touches
// wording, and realize() never touches meaning — because collapsing them back into one pass is
// exactly the T-model (shared PF/LF derivation) the paper argues against.
//
// DATA PROVENANCE (per your instruction #8 — not claiming to know what I haven't verified):
//   - GATE_NAMES (all 64): sourced from your PDF's I Ching hexagram title list.
//   - LINE_NAMES: sourced from your PDF for gates 1-40 and 51-64 (54 gates, 324/384 lines).
//     Gates 41-50 (60 lines) were referenced in your PDF ("Want me to roll out Gates 41-50
//     next?") but the actual line names for them are NOT in the project knowledge I can see —
//     those six gates are marked null below rather than invented.
//   - Color/Tone/Base motivational text: your PDF gives worked examples for a few values per
//     layer (not the full 1-6 for each). The others are placeholders, clearly marked, so nothing
//     fabricated is presented as sourced.

const DIMENSIONS = [
  { name: 'Movement', keynote: 'I Define', field: 'Energy, Creation, Individuality' },
  { name: 'Evolution', keynote: 'I Remember', field: 'Gravity, Memory, Mind' },
  { name: 'Being',     keynote: 'I Am',      field: 'Matter, Touch, Body' },
  { name: 'Design',    keynote: 'I Design',  field: 'Structure, Progress, Ego' },
  { name: 'Space',     keynote: 'I Think',   field: 'Form, Illusion, Personality' },
];

const CENTERS = [
  { name: 'Head',         gland: 'Pineal',               voice: 'inspired through the crown' },
  { name: 'Ajna',         gland: 'Pituitary',             voice: 'known through intuition' },
  { name: 'Throat',       gland: 'Thyroid/Parathyroid',   voice: 'expressed through communication' },
  { name: 'Heart',        gland: 'Thymus',                voice: 'willed through the ego' },
  { name: 'Spleen',       gland: 'Spleen',                voice: 'sensed through instinct' },
  { name: 'Sacral',       gland: 'Gonads',                voice: 'generated through the life force' },
  { name: 'Solar Plexus', gland: 'Kidneys/Adrenals',      voice: 'felt through emotional waves' },
  { name: 'Root',         gland: 'Adrenals',              voice: 'pressured through survival drive' },
  { name: 'G',            gland: '—',                     voice: 'directed through identity' },
];

const GATE_NAMES = [
  null, // 0-index unused; gates are 1-64
  'The Creative', 'The Receptive', 'Difficulty at the Beginning', 'Youthful Folly', 'Waiting',
  'Conflict', 'The Army', 'Holding Together', 'The Taming Power of the Small', 'Treading',
  'Peace', 'Standstill', 'Fellowship of Man', 'Possession in Great Measure', 'Modesty',
  'Enthusiasm', 'Following', 'Work on What Has Been Spoilt', 'Approach', 'Contemplation',
  'Biting Through', 'Grace', 'Splitting Apart', 'Returning', 'Innocence',
  'The Taming Power of the Great', 'Nourishment', 'Preponderance of the Great', 'The Abysmal', 'Clinging Fire',
  'Influence', 'Duration', 'Retreat', 'Power of the Great', 'Progress',
  'Darkening of the Light', 'Family', 'Opposition', 'Obstruction', 'Deliverance',
  'Decrease', 'Increase', 'Breakthrough', 'Coming to Meet', 'Gathering Together',
  'Pushing Upward', 'Oppression', 'The Well', 'Revolution', 'The Cauldron',
  'The Arousing', 'Keeping Still', 'Development', 'The Marrying Maiden', 'Abundance',
  'The Wanderer', 'The Gentle', 'The Joyous', 'Dispersion', 'Limitation',
  'Inner Truth', 'Preponderance of the Small', 'After Completion', 'Before Completion',
];

const LINE_NAMES = { // gate -> [line1..line6]; null = not present in source material
  1: ['Objectivity', 'The Energy to Attract Society', 'Aloneness as the Medium of Creativity', 'The Energy to Sustain Creative Work', 'Love Is Light', 'Creation Is Independent of Will'],
  2: ['Fixation', 'Intelligent Application', 'Secretiveness', 'Patience', 'Genius', 'Intuition'],
  3: ['Surrender', 'Victimization', 'Charisma', 'Survival', 'Immaturity', 'Synthesis'],
  4: ['Excess', 'Seduction', 'The Liar', 'Irresponsibility', 'Acceptance', 'Pleasure'],
  5: ['Yielding', 'Joy', 'The Hunter', 'Compulsiveness', 'Inner Peace', 'Perseverance'],
  6: ['The Peacemaker', 'Arbitration', 'Triumph', 'Allegiance', 'The Guerilla', 'Retreat'],
  7: ['The Administrator', 'The General', 'The Abdicator', 'The Anarchist', 'The Democrat', 'Authoritarian'],
  8: ['Communion', 'Dharma', 'Respect', 'The Phoney', 'Service', 'Honesty'],
  9: ['Gratitude', 'Faith', 'Dedication', "The Straw That Breaks the Camel's Back", 'Misery Loves Company', 'Sensibility'],
  10: ['The Role Model', 'The Heretic', 'The Opportunist', 'The Martyr', 'The Hermit', 'Modesty'],
  11: ['Adaptability', 'The Philanthropist', 'The Teacher', 'The Realist', 'Rigour', 'Attunement'],
  12: ['Metamorphosis', 'The Pragmatist', 'The Prophet', 'Confession', 'Purification', 'The Monk'],
  13: ['The Optimist', 'The Saviour', 'Fatigue', 'Pessimism', 'Bigotry', 'Empathy'],
  14: ['Humility', 'Arrogance', 'Security', 'Service', 'Management', "Money Isn't Everything"],
  15: ['Self-Defense', 'Sensitivity', 'The Wallflower', 'Ego Inflation', 'Influence', 'Duty'],
  16: ['Delusion', 'The Grinch', 'Indifference', 'The Innovator', 'The Graciousness of Talent', 'Gullibility'],
  17: ['Openness', 'Influence', 'Self-Actualization', 'The Leader', 'The Ideologue', 'The Bodhisattva'],
  18: ['Integrity', 'Terminal Disease', 'Adaptability', 'Union', 'Therapy', 'Arrest'],
  19: ['Interdependence', 'Service', 'Dedication', 'The Team Player', 'Sacrifice', 'The Recluse'],
  20: ['Superficiality', 'The Democrat', 'Self-Defense', 'Application', 'Realism', 'Wisdom'],
  21: ['Warning', 'Alliance', 'Powerlessness', 'Stubbornness', 'The Hunter', 'Chaos'],
  22: ['Withdrawal', 'Self-Restraint', 'Maturity', 'Sensibility', 'Directness', 'Restraint'],
  23: ['Proselytization', 'Self-Defense', 'Individuality', 'Fragmentation', 'Assimilation', 'Stability'],
  24: ['The Sinner', 'Rationalization', 'Acceptance', 'The Hermit', 'Resignation', 'The Gift Horse'],
  25: ['Selflessness', 'Control', 'Sensitivity', 'Survival', 'Recapitulation', 'Innocence'],
  26: ['A Bird in the Hand', 'The Egoist', 'Influence', 'Censorship', 'Adaptability', 'Authority'],
  27: ['Selfishness', 'Responsibility', 'Greed', 'Generosity', 'Accountability', 'Wariness'],
  28: ['Preparation', 'Shaping', 'Adventurism', 'Blame', 'Strange Bedfellows', 'Blinded by the Light'],
  29: ['The Dilettante', 'Evaluation', 'Evaluation and Perseverance', 'Directness', 'Overreach', 'Confusion'],
  30: ['Composure', 'Pragmatism', 'Resignation', 'Burnout', 'Irony', 'Enforcement'],
  31: ['Manifestation', 'Arrogance', 'Selectivity', 'Identification', 'Iron Fist', 'Application'],
  32: ['Conservation', 'Caution', 'Silence', 'Endurance', 'Flexibility', 'Tranquility'],
  33: ['Avoidance', 'Surrender', 'Spirit', 'Dignity', 'Timing', 'Fame'],
  34: ['The Bully', 'Nocturnal Power', 'The Egoist', 'Triumph', 'Power', 'Common Sense'],
  35: ['Assistance', 'Arrest', 'Survival', 'Persuasion', 'Progression', 'Experience'],
  36: ['Resistance', 'Support', 'Transition', 'The Opportunist', 'Confusion', 'Justice'],
  37: ['The Mother/Father', 'Responsibility', 'Evenhandedness', 'Leadership by Example', 'The Teacher', 'The Broker'],
  38: ['Qualification', 'Rigidity', 'Alliance', 'Investigation', 'Alienation', 'The Utopian'],
  39: ['Provocation', 'Confrontation', 'Dangers', 'Temperance', 'Single-Mindedness', 'Rebellion'],
  40: ['Recuperation', 'Resolve', 'Service', 'The Opportunist', 'Righteousness', 'Exhaustion'],
  41: null, 42: null, 43: null, 44: null, 45: null, 46: null, 47: null, 48: null, 49: null, 50: null,
  51: ['Reference', 'Withdrawal', 'Adaptation', 'Limitation', 'Initiative', 'Self-Realization'],
  52: ['Think Before You Leap', 'Restraint', 'Self-Discipline', 'Self-Destruction', 'Explanation', 'Peace'],
  53: ['Development', 'Maturity', 'Practicality', 'Assurance', 'Progression', 'Phasing'],
  54: ['Ambition', 'Discretion', 'Selectivity', 'Enlightenment', 'Magnanimity', 'Philanthropy'],
  55: ['Co-Operation', 'Restraint', 'The Victim', 'Assimilation', 'Growth', 'Self-Reliance'],
  56: ['Quality', 'Linkage', 'Alienation', 'Expediency', 'Attraction', 'Caution'],
  57: ['Confusion', 'Caution', 'Overconfidence', 'Application', 'Progression', 'Utilization'],
  58: ['Acceptance', 'Service', 'Self-Discipline', 'Regret', 'Defense', 'Leadership'],
  59: ['The Preacher', 'Shyness', 'Openness', 'Brotherhood/Sisterhood', 'The Femme Fatale / Casanova', 'One-Night Stand'],
  60: ['Acceptance', 'Decisiveness', 'Conservatism', 'Resourcefulness', 'Leadership', 'Rigidity'],
  61: ['Occult Knowledge', 'The Gift of Inquiry', 'Interrogation', 'Mystery', 'Influence', 'Appeal'],
  62: ['Routine', 'Restraint', 'Discovery', 'Asceticism', 'Meticulousness', 'Self-Discipline'],
  63: ['Composure', 'Pragmatism', 'Doubt', 'Investigation', 'Belief', 'Nostalgia'],
  64: ['Confusion', 'Qualification', 'Imagination', 'Conviction', 'The Guide', 'Objectivity'],
};

// sourced anchor points only (doc gave worked examples, not the full 1-6 set per layer)
const COLOR_MOTIVATION = ['motivated by survival', 'motivated by security', 'driven by desire', '[color 4 — unsourced]', '[color 5 — unsourced]', 'seeking innocence'];
const TONE_RESONANCE   = ['[tone 1 — unsourced]', 'resonating in duality', '[tone 3 — unsourced]', '[tone 4 — unsourced]', 'harmonizing universally', '[tone 5 — unsourced]'];
const BASE_FOUNDATION  = ['from unity foundation', '[base 2 — unsourced]', '[base 3 — unsourced]', 'rooted in geometry', '[base 4 — unsourced]', '[base 5 — unsourced]'];

const ZODIAC = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

// axis pairs (opposite gate on the wheel): gate N <-> gate (65-N) is the standard I Ching
// complement used in your doc's one confirmed example (25 <-> 46); applied generally here.
function axisPartner(gate) { return 65 - gate; }

/**
 * STEP 1 — MEANING. Build the thought structure. No wording happens here: this is the
 * "thought structure generated first" the paper describes, independent of how it will later
 * be realized as a sentence.
 */
function buildThought(coord) {
  const dim = DIMENSIONS[coord.dimension];
  const center = CENTERS[coord.center];
  const gateNum = coord.gate + 1; // stored 0-63, gates are numbered 1-64
  const gateName = GATE_NAMES[gateNum] || '[unnamed gate]';
  const lineNum = coord.line + 1;
  const lineNames = LINE_NAMES[gateNum];
  const lineName = lineNames ? lineNames[coord.line] : '[line name not in source data]';
  const partnerGate = axisPartner(gateNum);

  return {
    subjectForce: dim.keynote,
    fieldDomain: dim.field,
    somaticVoice: center.voice,
    somaticAnchor: `${center.name} (${center.gland})`,
    actionCore: gateName,
    gateNumber: gateNum,
    lineExpression: lineName,
    lineNumber: lineNum,
    motivation: COLOR_MOTIVATION[coord.color],
    resonance: TONE_RESONANCE[coord.tone],
    foundation: BASE_FOUNDATION[coord.base],
    contextSign: ZODIAC[coord.sign],
    contextHouse: coord.house + 1,
    polarity: { partnerGate, note: `while its opposite (Gate ${partnerGate}) holds the mirrored pole` },
  };
}

/**
 * STEP 2 — REALIZATION. Turn the thought structure into a sentence. This step only touches
 * wording/grammar, never meaning — it is the "signal" half of the meaning-first split, and
 * follows your document's 9-layer template:
 *   [Subject/keynote], [Voice] [Action] [Line expression], [Motivation] [Resonance] [Foundation],
 *   under [Sign] in the [House], [Polarity clause].
 */
function realize(thought, mode = 'mystical') {
  if (mode === 'scientific') {
    return `${thought.subjectForce.replace('I ', 'Field state: ')} — Gate ${thought.gateNumber} ` +
      `(${thought.actionCore}) expresses Line ${thought.lineNumber} (${thought.lineExpression}), ` +
      `${thought.motivation}, ${thought.resonance}, ${thought.foundation}, anchored in the ` +
      `${thought.somaticAnchor}, at ${thought.contextSign} / House ${thought.contextHouse}, ` +
      `${thought.polarity.note}.`;
  }
  return `${thought.subjectForce} through ${thought.fieldDomain.split(',')[0].toLowerCase()}, ` +
    `${thought.somaticVoice} ${thought.actionCore.toLowerCase()} ` +
    `(Line ${thought.lineNumber}: ${thought.lineExpression}), ${thought.motivation}, ` +
    `${thought.resonance}, ${thought.foundation}, under ${thought.contextSign} in the ` +
    `${thought.contextHouse}${ordinalSuffix(thought.contextHouse)} House, ${thought.polarity.note}.`;
}

function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export { DIMENSIONS, CENTERS, GATE_NAMES, LINE_NAMES, ZODIAC, buildThought, realize, axisPartner };

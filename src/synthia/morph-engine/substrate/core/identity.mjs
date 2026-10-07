import { stableId } from '../utils/hash.mjs';

const STOP = new Set('the a an and or of to in on for with is are was were be been being this that it as by from at into your you i we they them their our'.split(' '));

function words(text='') {
  return (text.toLowerCase().match(/[a-z0-9_\-]{3,}/g) || []).filter(w => !STOP.has(w));
}
function topTerms(text, n=16) {
  const counts = new Map();
  for (const w of words(text)) counts.set(w, (counts.get(w)||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([term,count])=>({term,count}));
}
function codeSignals(text='') {
  const tests = {
    animation:/requestAnimationFrame|animation|transition|keyframes/i,
    input:/keydown|keyup|pointer|touch|click|controls/i,
    physics:/velocity|gravity|collision|rigidbody|physics/i,
    rendering:/canvas|webgl|three\.|pixi|phaser|svg/i,
    persistence:/localStorage|indexedDB|save|load/i,
    audio:/audio|sound|oscillator|speechSynthesis/i,
    networking:/fetch\(|websocket|socket|http/i
  };
  return Object.fromEntries(Object.entries(tests).map(([k,r])=>[k,r.test(text)]));
}

export function extractIdentity(assets=[]) {
  const combined = assets.map(a => a.text || '').join('\n');
  const kinds = [...new Set(assets.map(a=>a.kind))];
  const identity = {
    id: '',
    kinds,
    terms: topTerms(combined),
    signals: codeSignals(combined),
    files: assets.map(a=>({name:a.name,kind:a.kind,size:a.size||0})),
    invariants: [],
    mutable: []
  };
  if (kinds.includes('game')) identity.invariants.push('core-loop','input-response','win-loss-or-progression');
  if (kinds.includes('website')) identity.invariants.push('content-hierarchy','navigation-intent','interaction-contracts');
  if (kinds.includes('image')) identity.invariants.push('visual-silhouette','palette-family','pose-landmarks');
  if (kinds.includes('text')) identity.invariants.push('semantic-intent','named-entities','tone-markers');
  identity.mutable = ['scene','surface-style','layout','timing','ornament','names','secondary-rules'];
  identity.id = stableId('identity', identity);
  return identity;
}

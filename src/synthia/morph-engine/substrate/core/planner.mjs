export function makePlan(identity, intent={}) {
  const mode = intent.mode || 'variation';
  const strength = Math.max(0, Math.min(1, intent.strength ?? 0.55));
  const preserve = [...new Set([...(identity.invariants||[]), ...(intent.preserve||[])])];
  const mutate = [...new Set([...(identity.mutable||[]), ...(intent.mutate||[])])].filter(x => !preserve.includes(x));
  return {
    mode,
    strength,
    preserve,
    mutate,
    target: intent.target || 'auto',
    prompt: intent.prompt || '',
    mergeStrategy: intent.mergeStrategy || (mode === 'merge' ? 'single-runtime' : 'federated-runtime')
  };
}

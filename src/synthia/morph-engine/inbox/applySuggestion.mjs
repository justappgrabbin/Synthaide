function normalize(a={}){ return {name:a.name||a.filename||'file',type:a.type||'',kind:a.kind||'',text:typeof a.code==='string'?a.code:(a.text||'')}; }

export function applySuggestionToAssets(baseAssets=[], suggestion={}) {
  if(suggestion.status!=='approved') throw new Error('Suggestion must be approved before it can be applied');
  const out=new Map(baseAssets.map(a=>{const n=normalize(a);return [n.name,n];}));
  for(const f of suggestion.files||[]) { const n=normalize(f); out.set(n.name,n); }
  return [...out.values()];
}

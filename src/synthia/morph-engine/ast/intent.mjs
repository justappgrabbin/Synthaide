function clean(s=''){ return s.trim().replace(/^['"`]|['"`]$/g,''); }

export function rewriteFromPrompt(prompt='') {
  const operations=[];
  const text=String(prompt||'');
  const renameRe=/\brename\s+([A-Za-z_$][\w$]*)\s+(?:to|as)\s+([A-Za-z_$][\w$]*)/gi;
  for(const m of text.matchAll(renameRe)) operations.push({type:'rename',from:m[1],to:m[2]});

  const importRe=/\b(?:rewrite|change)\s+import\s+(['"`]?[^\s,'"`]+['"`]?)\s+(?:to|as)\s+(['"`]?[^\s,'"`]+['"`]?)/gi;
  for(const m of text.matchAll(importRe)) operations.push({type:'rewrite-import',from:clean(m[1]),to:clean(m[2])});

  const quotedReplace=/\b(?:replace|change)\s+(['"`])(.+?)\1\s+(?:with|to)\s+(['"`])(.+?)\3/gi;
  for(const m of text.matchAll(quotedReplace)) operations.push({type:'replace-string',from:m[2],to:m[4]});
  return operations.length ? {operations} : null;
}

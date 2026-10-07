function bodyOf(html='') {
  const m=html.match(/<body[^>]*>([\s\S]*?)<\/body>/i); return m?m[1]:html;
}
function stylesOf(html='') { return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]); }
function scriptsOf(html='') { return [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]); }
function stripEmbedded(html=''){ return bodyOf(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<script[^>]*>[\s\S]*?<\/script>/gi,''); }
function scopeCss(css, scope){
  return css.replace(/(^|})\s*([^@}{][^{]+)\{/g,(m,close,selectors)=>{
    const s=selectors.split(',').map(x=>`${scope} ${x.trim()}`).join(', '); return `${close}\n${s}{`;
  });
}
function namespaceIds(html, ns){
  const ids=[];
  let out=html.replace(/id=["']([^"']+)["']/gi,(m,id)=>{ids.push(id);return `id="${ns}-${id}"`;});
  for(const id of ids){
    const safe=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    out=out.replace(new RegExp(`([#]|for=["'])${safe}(["']?)`,'g'),(m,p,s)=>`${p}${ns}-${id}${s}`);
  }
  return out;
}
export function convergeWebAssets(assets, mode='combine'){
  const htmls=assets.filter(a=>/\.html?$/i.test(a.name||'') || (a.kind==='website' && /<[^>]+>/.test(a.text||'')));
  const cssFiles=assets.filter(a=>/\.css$/i.test(a.name||''));
  const jsFiles=assets.filter(a=>/\.(m?js|cjs)$/i.test(a.name||''));
  const modules=htmls.map((a,i)=>{
    const ns=`morph-${i+1}`;
    const html=namespaceIds(stripEmbedded(a.text),ns);
    const css=[...stylesOf(a.text),...cssFiles.filter((_,j)=>htmls.length===1||j===i).map(x=>x.text)].map(c=>scopeCss(c,`#${ns}`)).join('\n');
    const js=[...scriptsOf(a.text),...jsFiles.filter((_,j)=>htmls.length===1||j===i).map(x=>x.text)].join('\n');
    return {ns,name:a.name,html,css,js};
  });
  if(!modules.length) return null;
  const body=modules.map(m=>`<section id="${m.ns}" data-source="${m.name}">${m.html}</section>`).join('\n');
  const css=modules.map(m=>m.css).join('\n');
  const js=modules.map(m=>`(()=>{\n// ${m.name}\n${m.js}\n})();`).join('\n');
  const bridge = mode==='merge' ? `\nwindow.MorphBus=window.MorphBus||new EventTarget();\nwindow.morphState=window.morphState||Object.create(null);` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}<script>${bridge}\n${js}<\/script></body></html>`;
}

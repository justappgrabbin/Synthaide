function collect(text, re){ return [...text.matchAll(re)].map(m=>m[1]).filter(Boolean); }
export class WebsiteMorpher {
  canHandle(assets){ return assets.some(a=>a.kind==='website' || a.kind==='code'); }
  morph(assets, ctx){
    const html = assets.find(a=>/\.html?$/i.test(a.name||''))?.text || assets.find(a=>a.kind==='website')?.text || '';
    const css = assets.filter(a=>/\.css$/i.test(a.name||'')).map(a=>a.text).join('\n');
    const js = assets.filter(a=>/\.(m?js|cjs|ts|jsx|tsx)$/i.test(a.name||'')).map(a=>a.text).join('\n');
    const ids = collect(html, /id=["']([^"']+)/g);
    const classes = collect(html, /class=["']([^"']+)/g).flatMap(x=>x.split(/\s+/));
    const controls = collect(html, /<(?:button|a)[^>]*>([^<]+)/gi);
    const gaps = [];
    if (html && !js) gaps.push('No interaction script detected');
    if (/<form/i.test(html) && !/submit|FormData/i.test(js)) gaps.push('Form exists without clear submit behavior');
    if ((ids.length+classes.length)>0 && css.length<50) gaps.push('Structure exists but styling is sparse');
    if (!/nav|menu/i.test(html) && html.length>500) gaps.push('Likely missing navigation shell');
    return {
      kind:'website-continuation-plan',
      summary:'Detects unfinished contracts and continues from existing DOM/CSS/JS instead of replacing the site.',
      inventory:{ids:[...new Set(ids)], classes:[...new Set(classes)], controls, jsBytes:js.length, cssBytes:css.length},
      gaps,
      continuation: gaps.map((g,i)=>({id:i+1, gap:g, action:recommend(g, ctx.plan)}))
    };
  }
}
function recommend(g, plan){
  if (/interaction/.test(g)) return `wire existing controls first; preserve current DOM contracts; variation strength ${plan.strength}`;
  if (/Form/.test(g)) return 'add local validation + submit handler + visible state feedback';
  if (/styling/.test(g)) return 'derive tokens from existing selectors and complete responsive states';
  if (/navigation/.test(g)) return 'derive navigation from current page sections rather than inventing unrelated routes';
  return 'continue the nearest incomplete structure';
}

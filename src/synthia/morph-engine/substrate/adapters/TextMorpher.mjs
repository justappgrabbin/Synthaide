export class TextMorpher {
  canHandle(assets){ return assets.some(a=>a.kind==='text'); }
  morph(assets, ctx){
    const source = assets.map(a=>a.text||'').join('\n\n');
    const terms = ctx.identity.terms.slice(0,8).map(x=>x.term);
    const prompt = ctx.plan.prompt ? `\nDirection: ${ctx.plan.prompt}` : '';
    return {
      kind:'text-blueprint',
      summary:`Semantic scaffold preserving: ${ctx.plan.preserve.join(', ')}`,
      blueprint:{keywords:terms, sourceLength:source.length, direction:ctx.plan.prompt, strength:ctx.plan.strength},
      content:`Morph seed\nKeywords: ${terms.join(', ')}${prompt}\n\n${source}`
    };
  }
}

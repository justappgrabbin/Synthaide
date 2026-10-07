import { convergeWebAssets } from '../core/converge.mjs';
export class CompositeMorpher {
  canHandle(assets){ return assets.length > 1; }
  morph(assets, ctx){
    const mode = ctx.plan.mode === 'merge' ? 'merge' : 'combine';
    const namespaces = assets.map((a,i)=>({file:a.name, namespace:`m${i+1}`, kind:a.kind}));
    const outputHtml = convergeWebAssets(assets, mode);
    return {
      kind:'convergence-plan', mode,
      summary: mode==='merge'
        ? 'Normalizes the parts into one shared runtime and resolves overlapping roles.'
        : 'Keeps each part intact behind adapters, then lets them coexist in one app shell.',
      namespaces,
      outputHtml,
      steps: mode==='merge' ? [
        'extract shared contracts','deduplicate utilities','resolve event and CSS namespace collisions','unify state bus','emit one runtime'
      ] : [
        'preserve each module','wrap each with an adapter','mount shared event bus','compose views','emit one shell'
      ]
    };
  }
}

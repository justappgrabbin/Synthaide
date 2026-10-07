function has(re,t){return re.test(t)}
export class GameMorpher {
  canHandle(assets){ return assets.some(a=>a.kind==='game'); }
  morph(assets, ctx){
    const code = assets.map(a=>a.text||'').join('\n');
    const mechanics = {
      input: has(/key|pointer|touch|gamepad|controls/i,code),
      movement: has(/velocity|position|move|speed|jump/i,code),
      collision: has(/collision|overlap|intersect|hitbox/i,code),
      score: has(/score|points|coins|xp|health/i,code),
      loop: has(/requestAnimationFrame|update\(|tick\(|loop\(/i,code),
      levels: has(/level|stage|scene|room|map/i,code)
    };
    const preserved = Object.entries(mechanics).filter(([,v])=>v).map(([k])=>k);
    return {
      kind:'game-variation-plan',
      summary:'Keeps the mechanical signature while mutating scene grammar, presentation, pacing, and secondary rules.',
      mechanics,
      preserve:preserved,
      mutate:{scene:true, theme:true, assets:true, pacing:ctx.plan.strength>0.35, topology:ctx.plan.strength>0.65},
      recipe:[
        'extract player/enemy/environment roles',
        'freeze detected input and progression contracts',
        'replace scene vocabulary and asset bindings',
        'remap level topology without breaking reachability',
        'run invariant tests against the original mechanical signature'
      ]
    };
  }
}

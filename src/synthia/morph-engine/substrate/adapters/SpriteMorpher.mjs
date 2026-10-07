function lerp(a,b,t){ return a + (b-a)*t; }
export class SpriteMorpher {
  canHandle(assets){ return assets.some(a=>a.kind==='image'); }
  morph(assets, ctx){
    const fps = Math.round(8 + ctx.plan.strength*16);
    const inbetweens = Math.round(2 + ctx.plan.strength*6);
    const motionGraph = {
      states:['idle','walk','talk','express'],
      transitions:[
        ['idle','walk'],['walk','idle'],['idle','talk'],['talk','express'],['express','idle']
      ],
      interpolation:{mode:'landmark+tween', inbetweens, fps, easing:'cubic-in-out'}
    };
    return {
      kind:'sprite-rig-plan',
      summary:'Builds a controllable animation graph from sprite-sheet poses; missing motion is synthesized as deterministic in-between transforms.',
      motionGraph,
      runtime: buildRuntimeCode(motionGraph)
    };
  }
}
function buildRuntimeCode(graph){
return `export class SpriteActor {\n  constructor(frames){ this.frames=frames; this.state='idle'; this.t=0; this.fps=${graph.interpolation.fps}; }\n  setState(next){ this.state=next; this.t=0; }\n  tween(a,b,t){ return {x:${lerp.toString()}(a.x,b.x,t), y:${lerp.toString()}(a.y,b.y,t), rot:${lerp.toString()}(a.rot||0,b.rot||0,t), sx:${lerp.toString()}(a.sx||1,b.sx||1,t), sy:${lerp.toString()}(a.sy||1,b.sy||1,t)}; }\n  update(dt){ this.t += dt; return this.state; }\n}`;
}

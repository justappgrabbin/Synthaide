import { analyzeJavaScript } from '../ast/analyze.mjs';
import { stableId } from '../utils/hash.mjs';
import { normalizePath } from '../graph/AssetGraph.mjs';

function tokens(value=''){
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g,'$1 $2')
    .replace(/[^A-Za-z0-9]+/g,' ')
    .trim().toLowerCase().split(/\s+/).filter(Boolean)
    .filter(x=>!['on','handle','handler','do','the','a','an','event','button','btn'].includes(x));
}
function basename(path=''){
  const last=normalizePath(path).split('/').pop()||'';
  return last.replace(/\.[^.]+$/,'');
}
function similarity(a,b){
  const A=new Set(tokens(a)), B=new Set(tokens(b));
  if(!A.size||!B.size) return 0;
  let hit=0; for(const x of A) if(B.has(x)) hit++;
  const union=new Set([...A,...B]).size;
  let score=hit/union;
  const aa=[...A].join(''), bb=[...B].join('');
  if(aa===bb) score=Math.max(score,1);
  else if(aa.includes(bb)||bb.includes(aa)) score=Math.max(score,.78);
  return score;
}
function rootBus(bus=''){
  const first=String(bus).split('.')[0];
  return /^[A-Za-z_$][\w$]*$/.test(first)?first:null;
}
function relativeImport(from,to){
  const fp=normalizePath(from).split('/'); fp.pop();
  const tp=normalizePath(to).split('/');
  while(fp.length&&tp.length&&fp[0]===tp[0]){ fp.shift(); tp.shift(); }
  let rel=[...fp.map(()=> '..'),...tp].join('/');
  if(!rel.startsWith('.')) rel='./'+rel;
  return rel;
}
function getAnalyses(assets=[]){
  const out=[];
  for(const a of assets){
    if(!/\.(?:js|mjs|cjs)$/i.test(a.name||'')) continue;
    try{
      const x=analyzeJavaScript(a.text||a.code||'',a.name);
      out.push({...x,text:a.text||a.code||''});
    }catch{}
  }
  return out;
}
function functionEndpoints(assets,graph){
  const analyses=getAnalyses(assets);
  const entryScripts=new Set((graph.edges||[]).filter(e=>e.relation==='html:script:src'&&e.resolved).map(e=>e.resolved));
  const out=[];
  for(const a of analyses){
    for(const f of a.functions){
      out.push({
        kind:'function',file:a.filename,name:f.name,params:f.params,async:f.async,
        exported:a.exports.includes(f.name),sourceType:a.sourceType,
        active:entryScripts.has(a.filename)||(graph.incoming?.[a.filename]||0)>0
      });
    }
  }
  return out;
}
function bestFunction(seed,assets,graph,{preferFile}={}){
  const xs=functionEndpoints(assets,graph).map(x=>{
    let score=similarity(seed,x.name);
    if(x.exported) score+=.05;
    if(x.active) score+=.05;
    if(preferFile&&x.file===preferFile) score+=.08;
    return {...x,score:Math.min(1,score)};
  }).sort((a,b)=>b.score-a.score);
  return xs[0]||null;
}
function bestControl(seed,graph){
  const xs=(graph.html?.controls||[]).filter(c=>c.id).map(c=>({
    kind:'control',file:c.file,selector:'#'+c.id,tag:c.tag,event:c.tag==='form'?'submit':'click',score:similarity(seed,c.id)
  })).sort((a,b)=>b.score-a.score);
  return xs[0]||null;
}
function unresolvedImportContract(gap,graph){
  const imports=graph.js?.imports?.[gap.file]||[];
  const imp=imports.find(x=>x.source===gap.reference);
  if(!imp) return null;
  const expected=(imp.specifiers||[]).map(s=>s.imported).filter(x=>x&&x!=='default');
  const candidates=[];
  for(const [file,exports] of Object.entries(graph.js?.exports||{})){
    if(file===gap.file) continue;
    const exportSet=new Set(exports||[]);
    const covers=expected.length?expected.filter(x=>exportSet.has(x)).length/expected.length:0;
    const nameScore=similarity(basename(gap.reference),basename(file));
    const score=Math.max(covers,nameScore*.8)+(covers===1?.12:0);
    if(score>0) candidates.push({file,exports,score:Math.min(1,score),covers});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  if(!best||best.score<.72) return null;
  return {
    strategy:'rewrite-import',confidence:best.score,
    source:{kind:'import',file:gap.file,reference:gap.reference,specifiers:imp.specifiers||[]},
    target:{kind:'file',file:best.file,exports:best.exports,newSource:relativeImport(gap.file,best.file)},
    rationale:`${best.file} best satisfies the missing import by exported-symbol and filename similarity.`
  };
}

export function inferInterface(gap,graph,assets=[]){
  if(!gap) return {supported:false,confidence:0,rationale:'No gap supplied.'};
  let core=null;
  if(gap.type==='unhandled-control'){
    const seed=String(gap.selector||'').replace(/^#/,'');
    const target=bestFunction(seed,assets,graph);
    if(target&&target.score>=.72){
      core={strategy:'control-to-function',confidence:target.score,
        source:{kind:'control',file:gap.file,selector:gap.selector,event:gap.tag==='form'?'submit':'click'},
        target,rationale:`${gap.selector} most closely matches function ${target.name} in ${target.file}.`};
    }
  } else if(gap.type==='consumer-without-producer'){
    const source=bestControl(gap.event,graph);
    const bus=rootBus(gap.bus);
    if(source&&source.score>=.72&&bus){
      core={strategy:'control-to-event',confidence:source.score,
        source,target:{kind:'event',file:gap.file,bus,event:gap.event},
        rationale:`${source.selector} most closely matches the unproduced event “${gap.event}”.`};
    }
  } else if(gap.type==='event-without-consumer'){
    const target=bestFunction(gap.event,assets,graph,{preferFile:gap.file});
    const bus=rootBus(gap.bus);
    if(target&&target.score>=.72&&bus){
      const emitter=getAnalyses(assets).find(x=>x.filename===gap.file);
      const canCross=target.file===gap.file || (target.exported && emitter?.sourceType==='module');
      if(canCross){
        core={strategy:'event-to-function',confidence:target.score,
          source:{kind:'event',file:gap.file,bus,event:gap.event,sourceType:emitter?.sourceType||'script'},
          target,rationale:`Event “${gap.event}” most closely matches function ${target.name} in ${target.file}.`};
      }
    }
  } else if(gap.type==='unresolved-import') core=unresolvedImportContract(gap,graph);

  if(!core){
    return {id:stableId('contract',{gapId:gap.id,type:gap.type}),gapId:gap.id,gapType:gap.type,supported:false,confidence:0,
      source:null,target:null,strategy:'manual-interface-required',requirements:[],rationale:'No sufficiently confident safe interface match was found. Human or higher-level semantic context is required.'};
  }
  return {
    id:stableId('contract',{gapId:gap.id,strategy:core.strategy,source:core.source,target:core.target}),
    gapId:gap.id,gapType:gap.type,supported:true,...core,
    requirements:[
      'Preserve existing exports and parseability',
      'Do not modify live files before approval',
      'Sandbox the complete project with the candidate overlaid before installation'
    ]
  };
}

export class InterfaceInference {
  infer(gap,graph,assets=[]){ return inferInterface(gap,graph,assets); }
}

export { similarity, tokens, relativeImport };

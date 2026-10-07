import { stableId } from '../utils/hash.mjs';

const NATIVE_EVENTS=new Set(['click','change','input','submit','keydown','keyup','keypress','pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','touchstart','touchend','focus','blur','load','DOMContentLoaded','resize','scroll']);
function uniq(xs,key=x=>JSON.stringify(x)){ const seen=new Set(); return xs.filter(x=>{const k=key(x); if(seen.has(k)) return false; seen.add(k); return true;}); }
function gap(type,severity,message,details={},confidence='high'){
  return {id:stableId('gap',JSON.stringify({type,message,details})),type,severity,confidence,message,...details};
}
function selectorExists(selector,html){
  if(!selector) return true;
  if(/^#[\w:-]+$/.test(selector)) return !!html.ids[selector.slice(1)];
  if(/^\.[\w:-]+$/.test(selector)) return !!html.classes[selector.slice(1)];
  return true; // compound selectors need a real DOM parser; do not invent a failure.
}
function isLikelyEntry(name='',graph){ return graph.entrypoints.includes(name)||/(^|\/)(?:package\.json|README(?:\.[^/]+)?|manifest\.json|service-worker\.js)$/i.test(name)||/(^|\/)tests?\//i.test(name); }
function controlTarget(c){ return c.id?`#${c.id}`:''; }
function eventKey(x){ return `${x.bus||''}:${x.event}`; }

export function detectGaps(graph,{includeOrphans=true}={}){
  const gaps=[];
  for(const e of graph.edges||[]){
    if(!e.external&&!e.resolved){
      gaps.push(gap(e.relation==='js:import'?'unresolved-import':'missing-asset','high',`${e.from} references ${e.to}, but no matching project asset exists.`,{file:e.from,reference:e.to,relation:e.relation,index:e.index,scope:[e.from,e.to]}));
    }
  }
  for(const r of graph.js?.domRefs||[]){
    if(!selectorExists(r.selector,graph.html||{ids:{},classes:{}})) gaps.push(gap('missing-dom-target','high',`${r.file} queries ${r.selector}, but that target is not declared by the project HTML.`,{file:r.file,selector:r.selector,index:r.index,scope:[r.file,r.selector]}));
  }
  const handledTargets=new Set((graph.js?.domListeners||[]).map(x=>x.target));
  for(const c of graph.html?.controls||[]){
    const target=controlTarget(c); if(!target||c.inlineHandler) continue;
    if(!handledTargets.has(target)) gaps.push(gap('unhandled-control','medium',`${c.file} contains an interactive ${c.tag} ${target} with no statically detected handler.`,{file:c.file,selector:target,tag:c.tag,index:c.index,scope:[c.file,target]},'medium'));
  }
  const emits=graph.js?.busEmits||[], listens=graph.js?.busListens||[];
  const listened=new Set(listens.map(eventKey)), emitted=new Set(emits.map(eventKey));
  for(const e of emits){
    if(!listened.has(eventKey(e)) && !NATIVE_EVENTS.has(e.event)) gaps.push(gap('event-without-consumer','medium',`${e.file} emits “${e.event}” on ${e.bus||'an event bus'}, but no matching consumer was detected.`,{file:e.file,event:e.event,bus:e.bus,scope:[e.file,e.event]},'medium'));
  }
  for(const l of listens){
    if(!emitted.has(eventKey(l)) && !NATIVE_EVENTS.has(l.event)) gaps.push(gap('consumer-without-producer','low',`${l.file} listens for “${l.event}” on ${l.bus||'an event bus'}, but no project producer was detected.`,{file:l.file,event:l.event,bus:l.bus,scope:[l.file,l.event]},'low'));
  }
  if(includeOrphans){
    for(const n of graph.nodes||[]){
      if(n.type!=='file'||n.entrypoint||isLikelyEntry(n.name,graph)) continue;
      if((graph.incoming?.[n.name]||0)===0 && !/\.(?:md|txt)$/i.test(n.name)) gaps.push(gap('orphan-asset','low',`${n.name} has no incoming project reference and may be unmounted or unused.`,{file:n.name,kind:n.kind,scope:[n.name]},'low'));
    }
  }
  for(const err of graph.errors||[]) gaps.push(gap('asset-parse-error','high',`${err.file} could not be analyzed: ${err.message}`,{file:err.file,scope:[err.file]}));
  const cleaned=uniq(gaps,x=>`${x.type}:${x.file||''}:${x.reference||x.selector||x.event||''}:${x.message}`);
  const counts=cleaned.reduce((a,x)=>(a[x.severity]=(a[x.severity]||0)+1,a),{});
  return {passed:cleaned.every(x=>x.severity!=='high'),gaps:cleaned,counts,summary:{total:cleaned.length,high:counts.high||0,medium:counts.medium||0,low:counts.low||0}};
}

export function gapSuggestionDraft(g){
  const labels={
    'unresolved-import':'Repair unresolved import','missing-asset':'Restore missing asset','missing-dom-target':'Repair missing UI target','unhandled-control':'Connect unhandled control','event-without-consumer':'Connect event consumer','consumer-without-producer':'Connect event producer','orphan-asset':'Mount or retire orphan asset','asset-parse-error':'Repair unreadable project asset'
  };
  return {
    category:'gap-diagnostic', installable:false, gapId:g.id,
    title:labels[g.type]||`Investigate ${g.type}`,
    why:g.message,
    what:`Detected ${g.type} (${g.severity} severity, ${g.confidence} confidence).`,
    does:'Creates an approval-visible work item. It does not modify the live project until a concrete candidate fix is generated and sandboxed.',
    expectedBenefit:'Close a project gap while preserving the existing working structure.',
    risk:g.severity,
    scope:g.scope||[g.file].filter(Boolean),
    provenance:{source:'gap-detector',gapId:g.id,gapType:g.type,createdBy:'asset-graph'},
    evidence:[{type:'gap',gap:g}], files:[],
    verification:{passed:true,diagnostic:true,phase:'detection',note:'Detection only; no candidate code has been installed or executed.'}
  };
}

export class GapDetector {
  detect(graph,options={}){ return detectGaps(graph,options); }
  toSuggestionDrafts(report,{minSeverity='medium'}={}){
    const rank={low:1,medium:2,high:3}; const min=rank[minSeverity]||1;
    return (report.gaps||[]).filter(g=>(rank[g.severity]||0)>=min).map(gapSuggestionDraft);
  }
}

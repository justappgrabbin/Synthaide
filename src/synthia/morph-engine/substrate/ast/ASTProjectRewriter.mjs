import { analyzeProject, analyzeJavaScript } from './analyze.mjs';
import { rewriteJavaScript } from './rewrite.mjs';

function normalizeOps(rewrite={}){
  const ops=[];
  for(const [from,to] of Object.entries(rewrite.rename||{})) ops.push({type:'rename',from,to});
  for(const [from,to] of Object.entries(rewrite.imports||{})) ops.push({type:'rewrite-import',from,to});
  for(const [from,to] of Object.entries(rewrite.strings||{})) ops.push({type:'replace-string',from,to});
  for(const x of rewrite.operations||[]) ops.push(x);
  if(rewrite.prepend) ops.push({type:'prepend',code:rewrite.prepend});
  if(rewrite.append) ops.push({type:'append',code:rewrite.append});
  return ops;
}

export class ASTProjectRewriter {
  analyze(assets){ return analyzeProject(assets); }
  rewrite(assets, rewrite={}) {
    const graph=analyzeProject(assets);
    const operations=normalizeOps(rewrite);
    const outputs=[]; const skipped=[]; const errors=[];
    for(const a of assets){
      if(!/\.(?:mjs|cjs|js)$/i.test(a.name||'')) { skipped.push({name:a.name,reason:'non-js'}); continue; }
      if(graph.errors.some(e=>e.filename===a.name)) { skipped.push({name:a.name,reason:'unparseable'}); continue; }
      const fileOps=operations.filter(op=>!op.file || op.file===a.name);
      try {
        const before=analyzeJavaScript(a.text||'',a.name);
        const protect={
          exports: rewrite.protectExports===false?[]:before.exports,
          functions: (rewrite.protectFunctions||[]).filter(x=>typeof x==='string')
        };
        outputs.push(rewriteJavaScript(a.text||'',fileOps,{filename:a.name,protect}));
      } catch(e){ errors.push({filename:a.name,error:e.message}); }
    }
    return {kind:'ast-project-rewrite',graph:{files:graph.files,edges:graph.edges,errors:graph.errors},outputs,skipped,errors,verified:errors.length===0 && outputs.every(o=>o.verified)};
  }
}

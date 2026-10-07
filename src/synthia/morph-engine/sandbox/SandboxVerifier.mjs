import { analyzeProject, analyzeJavaScript } from '../ast/analyze.mjs';

function normalizeAsset(a={}) {
  return {
    name: a.filename || a.name || 'candidate.js',
    type: a.type || '',
    kind: a.kind || '',
    text: typeof a.code === 'string' ? a.code : (a.text || '')
  };
}

function hasRelativeImportFailure(graph) {
  return graph.edges.filter(e => !e.external && !e.resolved);
}

function checkContracts(assets, contracts={}) {
  const failures=[];
  const jsAssets=assets.filter(a=>/\.(?:js|mjs|cjs)$/i.test(a.name||''));
  const analyses=[];
  for(const a of jsAssets){
    try { analyses.push(analyzeJavaScript(a.text||'',a.name)); }
    catch(e) { failures.push({type:'parse',file:a.name,message:e.message}); }
  }
  const allExports=new Set(analyses.flatMap(x=>x.exports));
  const allFunctions=new Set(analyses.flatMap(x=>x.functions.map(f=>f.name)));
  const allFiles=new Set(assets.map(a=>a.name));
  for(const x of contracts.exports||[]) if(!allExports.has(x)) failures.push({type:'missing-export',name:x});
  for(const x of contracts.functions||[]) if(!allFunctions.has(x)) failures.push({type:'missing-function',name:x});
  for(const x of contracts.files||[]) if(!allFiles.has(x)) failures.push({type:'missing-file',name:x});
  for(const rule of contracts.contains||[]) {
    const target=assets.find(a=>a.name===rule.file);
    if(!target || !(target.text||'').includes(rule.text)) failures.push({type:'missing-text',file:rule.file,text:rule.text});
  }
  return failures;
}

function staticVerify(rawAssets, options={}) {
  const assets=rawAssets.map(normalizeAsset);
  const graph=analyzeProject(assets);
  const unresolved=hasRelativeImportFailure(graph);
  const contractFailures=checkContracts(assets, options.contracts||{});
  const failures=[
    ...graph.errors.map(e=>({type:'parse',file:e.filename,message:e.error})),
    ...unresolved.map(e=>({type:'unresolved-import',file:e.from,source:e.to})),
    ...contractFailures
  ];
  return {
    phase:'static',
    passed: failures.length===0,
    failures,
    graph:{files:graph.files,edges:graph.edges,errors:graph.errors}
  };
}

function buildRuntimeDocument(assets, {entryHtml, timeoutMs=1500}={}) {
  const html=assets.find(a=>a.name===entryHtml) || assets.find(a=>/\.html?$/i.test(a.name));
  const scripts=assets.filter(a=>/\.(?:js|mjs|cjs)$/i.test(a.name));
  const base=html?.text || '<!doctype html><html><head></head><body></body></html>';
  const harness=`<script>(function(){\nconst send=(type,payload={})=>parent.postMessage({__morphSandbox:true,type,...payload},'*');\nconst logs=[];\nfor(const k of ['log','warn','error']){const old=console[k];console[k]=function(...args){logs.push({level:k,args:args.map(x=>{try{return typeof x==='string'?x:JSON.stringify(x)}catch{return String(x)}})});old.apply(console,args)}}\nwindow.addEventListener('error',e=>send('runtime-error',{message:e.message,stack:e.error?.stack||''}));\nwindow.addEventListener('unhandledrejection',e=>send('runtime-error',{message:String(e.reason?.message||e.reason),stack:e.reason?.stack||''}));\nwindow.addEventListener('DOMContentLoaded',()=>setTimeout(()=>send('runtime-complete',{logs,dom:{title:document.title,bodyText:(document.body?.innerText||'').slice(0,2000),elements:document.querySelectorAll('*').length}}),${Math.max(50,Math.min(timeoutMs-50,500))}));\n})();<\/script>`;
  const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; media-src data: blob:; font-src data:;">`;
  const inline=scripts.map(s=>`<script>\n// sandbox:${s.name}\n${s.text}\n<\/script>`).join('\n');
  let doc=base;
  doc=doc.replace(/<script[^>]*src=["'][^"']+["'][^>]*><\/script>/gi,'');
  doc=doc.replace(/<script\s+type=["']module["'][^>]*>[\s\S]*?<\/script>/gi,'');
  if(/<head[^>]*>/i.test(doc)) doc=doc.replace(/<head[^>]*>/i,m=>m+csp+harness); else doc=csp+harness+doc;
  if(/<\/body>/i.test(doc)) doc=doc.replace(/<\/body>/i,inline+'</body>'); else doc+=inline;
  return doc;
}

async function runtimeVerify(rawAssets, options={}) {
  if(typeof document==='undefined' || typeof window==='undefined') {
    return {phase:'runtime',skipped:true,passed:true,reason:'browser-runtime-unavailable'};
  }
  const assets=rawAssets.map(normalizeAsset);
  const moduleLike=assets.filter(a=>/\.(?:js|mjs|cjs)$/i.test(a.name||'')).some(a=>{
    try { const x=analyzeJavaScript(a.text||'',a.name); return x.sourceType==='module' && (x.imports.length||x.exports.length); } catch { return false; }
  });
  if(moduleLike && !assets.some(a=>/\.html?$/i.test(a.name||''))) {
    return {phase:'runtime',skipped:true,partial:true,passed:true,reason:'esm-runtime-harness-not-yet-bundled'};
  }
  const timeoutMs=Math.max(250,options.timeoutMs||1500);
  const iframe=document.createElement('iframe');
  iframe.setAttribute('sandbox','allow-scripts');
  iframe.hidden=true;
  const srcdoc=buildRuntimeDocument(assets,options);
  const errors=[]; let completed=null;
  return await new Promise(resolve=>{
    let done=false;
    const finish=(timedOut=false)=>{
      if(done) return; done=true;
      window.removeEventListener('message',onMessage);
      iframe.remove();
      resolve({phase:'runtime',passed:errors.length===0&&!timedOut,failures:errors,timedOut,observation:completed});
    };
    const onMessage=e=>{
      if(e.source!==iframe.contentWindow || !e.data?.__morphSandbox) return;
      if(e.data.type==='runtime-error') errors.push({type:'runtime-error',message:e.data.message,stack:e.data.stack});
      if(e.data.type==='runtime-complete'){ completed={logs:e.data.logs||[],dom:e.data.dom||{}}; finish(false); }
    };
    window.addEventListener('message',onMessage);
    iframe.srcdoc=srcdoc;
    document.body.append(iframe);
    setTimeout(()=>finish(true),timeoutMs);
  });
}

export class SandboxVerifier {
  async verify(assets=[], options={}) {
    const normalized=assets.map(normalizeAsset);
    const stat=staticVerify(normalized,options);
    if(!stat.passed || options.runtime===false) {
      return {passed:stat.passed,static:stat,runtime:{phase:'runtime',skipped:true,passed:stat.passed,reason:!stat.passed?'static-verification-failed':'runtime-disabled'}};
    }
    const run=await runtimeVerify(normalized,options);
    return {passed:stat.passed&&run.passed,static:stat,runtime:run};
  }
}

export { staticVerify, runtimeVerify, buildRuntimeDocument };

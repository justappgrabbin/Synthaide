import { parseJavaScript } from './parse.mjs';
import { buildScopes, flattenBindings } from './scopes.mjs';
import { walk } from './walk.mjs';
import { analyzeJavaScript } from './analyze.mjs';

function quoteLike(raw,value){
  const q=raw?.startsWith('"')?'"':raw?.startsWith("'")?"'":'"';
  const body=String(value).replaceAll('\\','\\\\').replaceAll(q,'\\'+q).replaceAll('\n','\\n');
  return q+body+q;
}
function validIdentifier(name){ return /^[A-Za-z_$][\w$]*$/.test(name); }
function overlap(a,b){ return Math.max(a.start,b.start)<Math.min(a.end,b.end); }
function editKey(e){ return `${e.start}:${e.end}:${e.text??''}`; }

export function applyEdits(source, edits=[]) {
  const unique=[...new Map(edits.map(e=>[editKey(e),e])).values()];
  const sorted=unique.sort((a,b)=>a.start-b.start || b.end-a.end);
  for(let i=1;i<sorted.length;i++) if(overlap(sorted[i-1],sorted[i])) throw new Error(`Overlapping AST edits at ${sorted[i-1].start}-${sorted[i-1].end} and ${sorted[i].start}-${sorted[i].end}`);
  let out=source;
  for(const e of [...sorted].sort((a,b)=>b.start-a.start)) out=out.slice(0,e.start)+(e.text??'')+out.slice(e.end);
  return out;
}

function findFunction(ast,name){
  let found=null;
  walk(ast,n=>{ if(found) return; if(n.type==='FunctionDeclaration'&&n.id?.name===name) found=n; });
  return found;
}


function buildRenameContexts(ast,source){
  const map=new Map();
  const key=n=>`${n.start}:${n.end}`;
  walk(ast,(n)=>{
    if(n.type==='Property' && n.shorthand && n.value?.type==='Identifier'){
      const propName=source.slice(n.key.start,n.key.end);
      map.set(key(n.value),{start:n.start,end:n.end,textFor:to=>`${propName}: ${to}`});
    }
    if(n.type==='ImportSpecifier' && n.local?.type==='Identifier'){
      const imported=source.slice(n.imported.start,n.imported.end);
      if(n.local.start===n.imported.start && n.local.end===n.imported.end)
        map.set(key(n.local),{start:n.start,end:n.end,textFor:to=>`${imported} as ${to}`});
    }
    if(n.type==='ExportSpecifier' && n.local?.type==='Identifier'){
      const exported=source.slice(n.exported.start,n.exported.end);
      if(n.local.start===n.exported.start && n.local.end===n.exported.end)
        map.set(key(n.local),{start:n.start,end:n.end,textFor:to=>`${to} as ${exported}`});
    }
  });
  return map;
}

export function rewriteJavaScript(source, operations=[], {filename='input.js', protect={}}={}) {
  const {ast}=parseJavaScript(source,filename);
  const {root}=buildScopes(ast);
  const bindings=flattenBindings(root,filename);
  const renameContexts=buildRenameContexts(ast,source);
  const edits=[]; const applied=[];

  for(const op of operations){
    if(op.type==='rename') {
      if(!validIdentifier(op.to)) throw new Error(`Invalid identifier: ${op.to}`);
      const targets=op.symbolId ? bindings.filter(b=>b.id===op.symbolId) : bindings.filter(b=>b.name===op.from);
      if(!targets.length) { applied.push({...op,status:'not-found'}); continue; }
      for(const b of targets) for(const n of [...b.declarations,...b.references]) {
        const special=renameContexts.get(`${n.start}:${n.end}`);
        edits.push(special?{start:special.start,end:special.end,text:special.textFor(op.to),reason:'rename-context'}:{start:n.start,end:n.end,text:op.to,reason:'rename'});
      }
      applied.push({...op,status:'applied',bindings:targets.length,references:targets.reduce((n,b)=>n+b.references.length,0)});
    }
    else if(op.type==='rewrite-import') {
      let count=0;
      walk(ast,n=>{
        if(n.type==='ImportDeclaration' && n.source.value===op.from){ edits.push({start:n.source.start,end:n.source.end,text:quoteLike(source.slice(n.source.start,n.source.end),op.to)}); count++; }
        if((n.type==='ExportNamedDeclaration'||n.type==='ExportAllDeclaration') && n.source?.value===op.from){ edits.push({start:n.source.start,end:n.source.end,text:quoteLike(source.slice(n.source.start,n.source.end),op.to)}); count++; }
        if(n.type==='CallExpression' && n.callee.type==='Import' && n.arguments[0]?.type==='Literal' && n.arguments[0].value===op.from){ const x=n.arguments[0]; edits.push({start:x.start,end:x.end,text:quoteLike(source.slice(x.start,x.end),op.to)}); count++; }
      });
      applied.push({...op,status:count?'applied':'not-found',count});
    }
    else if(op.type==='replace-string') {
      let count=0;
      walk(ast,(n,p,k)=>{
        if(n.type==='Literal' && typeof n.value==='string' && n.value===op.from){
          if(p?.type==='ImportDeclaration'||p?.type==='ExportNamedDeclaration'||p?.type==='ExportAllDeclaration') return;
          edits.push({start:n.start,end:n.end,text:quoteLike(source.slice(n.start,n.end),op.to)}); count++;
        }
      });
      applied.push({...op,status:count?'applied':'not-found',count});
    }
    else if(op.type==='prepend') {
      edits.push({start:0,end:0,text:String(op.code||'')+'\n'}); applied.push({...op,status:'applied'});
    }
    else if(op.type==='append') {
      edits.push({start:source.length,end:source.length,text:'\n'+String(op.code||'')+'\n'}); applied.push({...op,status:'applied'});
    }
    else if(op.type==='inject-function-start'||op.type==='inject-function-end') {
      const fn=findFunction(ast,op.function); if(!fn?.body){ applied.push({...op,status:'not-found'}); continue; }
      const pos=op.type==='inject-function-start'?fn.body.start+1:fn.body.end-1;
      edits.push({start:pos,end:pos,text:'\n'+String(op.code||'')+'\n'}); applied.push({...op,status:'applied'});
    }
    else applied.push({...op,status:'unsupported'});
  }

  const code=applyEdits(source,edits);
  parseJavaScript(code,filename); // syntax gate
  const after=analyzeJavaScript(code,filename);
  const missingExports=(protect.exports||[]).filter(x=>!after.exports.includes(x));
  const missingFunctions=(protect.functions||[]).filter(x=>!after.functions.some(f=>f.name===x));
  if(missingExports.length||missingFunctions.length) throw new Error(`Invariant failure in ${filename}: missing ${[...missingExports.map(x=>'export:'+x),...missingFunctions.map(x=>'function:'+x)].join(', ')}`);
  return {filename,code,applied,edits:edits.length,analysis:after,verified:true};
}

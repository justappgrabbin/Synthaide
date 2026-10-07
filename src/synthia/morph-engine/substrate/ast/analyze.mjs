import { parseJavaScript } from './parse.mjs';
import { walk } from './walk.mjs';
import { buildScopes, flattenBindings } from './scopes.mjs';

function calleeName(n){
  if(!n) return '';
  if(n.type==='Identifier') return n.name;
  if(n.type==='MemberExpression') {
    const a=calleeName(n.object), b=n.computed?(n.property.value??calleeName(n.property)):calleeName(n.property);
    return [a,b].filter(Boolean).join('.');
  }
  return '';
}

export function analyzeJavaScript(source, filename='input.js') {
  const {ast,sourceType}=parseJavaScript(source,filename);
  const {root}=buildScopes(ast);
  const bindings=flattenBindings(root,filename).map(b=>({id:b.id,name:b.name,kind:b.kind,start:b.start,refs:b.references.length,decls:b.declarations.length}));
  const imports=[], exports=[], calls=[], listeners=[], functions=[], classes=[];
  walk(ast,(n,p,k)=>{
    if(n.type==='ImportDeclaration') imports.push({source:n.source.value,start:n.start,end:n.end,specifiers:n.specifiers.map(s=>s.local?.name).filter(Boolean)});
    if(n.type==='ExportNamedDeclaration') {
      if(n.declaration?.id?.name) exports.push(n.declaration.id.name);
      for(const s of n.specifiers||[]) exports.push(s.exported?.name||s.exported?.value);
    }
    if(n.type==='ExportDefaultDeclaration') exports.push('default');
    if(n.type==='FunctionDeclaration' && n.id) functions.push({name:n.id.name,start:n.start,async:n.async,params:n.params.length});
    if(n.type==='ClassDeclaration' && n.id) classes.push({name:n.id.name,start:n.start});
    if(n.type==='CallExpression') {
      const name=calleeName(n.callee); if(name) calls.push(name);
      if(/\.addEventListener$/.test(name) && n.arguments[0]?.type==='Literal') listeners.push({target:name.replace(/\.addEventListener$/,''),event:n.arguments[0].value});
    }
  });
  const uniq=a=>[...new Set(a)];
  return {
    filename, sourceType, bytes:source.length,
    imports, exports:uniq(exports.filter(Boolean)), functions, classes, bindings,
    calls:uniq(calls), listeners,
    lifecycle:{
      animation:calls.some(x=>x.endsWith('requestAnimationFrame')),
      timers:calls.some(x=>/setInterval|setTimeout/.test(x)),
      eventDriven:listeners.length>0,
      updateLike:functions.some(f=>/^(update|tick|loop|render|step)$/i.test(f.name))
    }
  };
}

function normalizePath(input=''){
  const out=[];
  for(const part of input.replaceAll('\\','/').split('/')){
    if(!part||part==='.') continue;
    if(part==='..') out.pop(); else out.push(part);
  }
  return out.join('/');
}
function dirname(file=''){ const p=normalizePath(file).split('/'); p.pop(); return p.join('/'); }
function resolveImport(from,spec,known){
  if(!spec.startsWith('.')) return null;
  const base=normalizePath([dirname(from),spec].filter(Boolean).join('/'));
  const candidates=[base,`${base}.js`,`${base}.mjs`,`${base}.cjs`,`${base}/index.js`,`${base}/index.mjs`];
  return candidates.find(x=>known.has(x))||null;
}

export function analyzeProject(assets=[]) {
  const files=[]; const errors=[];
  for(const a of assets){
    if(!/\.(?:mjs|cjs|js)$/i.test(a.name||'')) continue;
    try { files.push(analyzeJavaScript(a.text||'',a.name)); }
    catch(e){ errors.push({filename:a.name,error:e.message,loc:e.loc||null}); }
  }
  const byName=new Map(files.map(f=>[normalizePath(f.filename),f]));
  const known=new Set(byName.keys());
  const edges=[];
  for(const f of files) for(const i of f.imports) edges.push({
    from:f.filename, to:i.source, external:!i.source.startsWith('.'),
    resolved:i.source.startsWith('.')?resolveImport(f.filename,i.source,known):null
  });
  return {files,errors,edges,parseable:errors.length===0,byName};
}

import { parseJavaScript } from '../ast/parse.mjs';
import { walk } from '../ast/walk.mjs';

const TEXT_EXT=/\.(?:html?|css|js|mjs|cjs|json|md|txt|svg|xml|ya?ml)$/i;
const JS_EXT=/\.(?:js|mjs|cjs)$/i;
const HTML_EXT=/\.html?$/i;
const CSS_EXT=/\.css$/i;

function normalizePath(input=''){
  const out=[];
  for(const part of String(input).replaceAll('\\','/').split('/')){
    if(!part||part==='.') continue;
    if(part==='..') out.pop(); else out.push(part);
  }
  return out.join('/');
}
function dirname(file=''){ const p=normalizePath(file).split('/'); p.pop(); return p.join('/'); }
function stripRef(ref=''){ return String(ref).split('#')[0].split('?')[0].trim(); }
function isExternalRef(ref=''){
  return /^(?:[a-z]+:)?\/\//i.test(ref) || /^(?:data|blob|mailto|tel|javascript):/i.test(ref) || ref.startsWith('#');
}
function resolveReference(from, rawRef, known){
  const ref=stripRef(rawRef);
  if(!ref || isExternalRef(ref)) return {external:true,resolved:null,target:ref};
  const root = ref.startsWith('/') ? normalizePath(ref.slice(1)) : normalizePath([dirname(from),ref].filter(Boolean).join('/'));
  const candidates=[root,`${root}.js`,`${root}.mjs`,`${root}.cjs`,`${root}.css`,`${root}.html`,`${root}/index.html`,`${root}/index.js`,`${root}/index.mjs`];
  const resolved=candidates.find(x=>known.has(x))||null;
  return {external:false,resolved,target:root};
}
function extKind(name='',type='',fallback=''){
  if(fallback) return fallback;
  if(HTML_EXT.test(name)) return 'website';
  if(CSS_EXT.test(name)) return 'style';
  if(JS_EXT.test(name)) return 'code';
  if(/\.json$/i.test(name)) return 'data';
  if(/\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(name)||type.startsWith('image/')) return 'image';
  if(/\.(?:mp3|wav|ogg|m4a)$/i.test(name)||type.startsWith('audio/')) return 'audio';
  if(/\.(?:mp4|webm|mov)$/i.test(name)||type.startsWith('video/')) return 'video';
  return 'asset';
}
function attrMap(raw=''){
  const out={};
  const re=/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g; let m;
  while((m=re.exec(raw))) out[m[1].toLowerCase()]=m[2]??m[3]??m[4]??'';
  return out;
}
function extractHtml(text='',filename=''){
  const refs=[], ids=new Set(), classes=new Set(), controls=[];
  const tagRe=/<([a-z][\w:-]*)([^>]*)>/gi; let m;
  while((m=tagRe.exec(text))){
    const tag=m[1].toLowerCase(); if(tag.startsWith('/')) continue;
    const attrs=attrMap(m[2]||'');
    if(attrs.id) ids.add(attrs.id);
    for(const c of (attrs.class||'').split(/\s+/).filter(Boolean)) classes.add(c);
    const refAttrs=[];
    if(['script','img','source','audio','video','iframe','embed','input'].includes(tag) && attrs.src) refAttrs.push(['src',attrs.src]);
    if(tag==='link' && attrs.href) refAttrs.push(['href',attrs.href]);
    if(tag==='a' && attrs.href && !attrs.href.startsWith('#')) refAttrs.push(['href',attrs.href]);
    if(tag==='form' && attrs.action) refAttrs.push(['action',attrs.action]);
    if(attrs.poster) refAttrs.push(['poster',attrs.poster]);
    for(const [attr,value] of refAttrs) refs.push({from:filename,relation:`html:${tag}:${attr}`,ref:value,index:m.index});
    const interactive = tag==='button' || tag==='select' || tag==='textarea' || tag==='form' || (tag==='input' && !['hidden','text','password','email','number','search','url','date','time'].includes((attrs.type||'text').toLowerCase())) || attrs.role==='button';
    if(interactive){
      controls.push({file:filename,tag,id:attrs.id||'',name:attrs.name||'',type:attrs.type||'',inlineHandler:Object.keys(attrs).some(k=>/^on/.test(k)),index:m.index});
    }
  }
  const styleRe=/<style[^>]*>([\s\S]*?)<\/style>/gi;
  while((m=styleRe.exec(text))) for(const x of extractCss(m[1],filename).refs) refs.push({...x,relation:'html:inline-style-url'});
  return {refs,ids:[...ids],classes:[...classes],controls};
}
function extractCss(text='',filename=''){
  const refs=[], selectors=[]; let m;
  const urlRe=/url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  while((m=urlRe.exec(text))) if(m[2]) refs.push({from:filename,relation:'css:url',ref:m[2],index:m.index});
  const selRe=/(^|\})\s*([^@{}][^{]*)\{/gm;
  while((m=selRe.exec(text))) for(const s of m[2].split(',').map(x=>x.trim()).filter(Boolean)) selectors.push(s);
  return {refs,selectors};
}
function literalValue(n){ return n?.type==='Literal' && typeof n.value==='string' ? n.value : null; }
function memberName(n){
  if(!n||n.type!=='MemberExpression') return '';
  if(!n.computed && n.property?.type==='Identifier') return n.property.name;
  return literalValue(n.property)||'';
}
function callName(n){
  if(!n) return '';
  if(n.type==='Identifier') return n.name;
  if(n.type==='MemberExpression'){
    const left=callName(n.object), right=memberName(n); return [left,right].filter(Boolean).join('.');
  }
  return '';
}
function domSelectorFromCall(n){
  if(n?.type!=='CallExpression') return null;
  const name=callName(n.callee); const v=literalValue(n.arguments?.[0]); if(v==null) return null;
  if(name==='document.getElementById') return '#'+v;
  if(name==='document.querySelector'||name==='document.querySelectorAll') return v;
  return null;
}
function extractJs(text='',filename=''){
  const refs=[], domRefs=[], domListeners=[], busEmits=[], busListens=[], exports=[], imports=[];
  const variableTargets=new Map();
  const {ast}=parseJavaScript(text,filename);
  walk(ast,n=>{
    if(n.type==='ImportDeclaration'){
      const ref=String(n.source.value); imports.push({source:ref,specifiers:(n.specifiers||[]).map(s=>({local:s.local?.name||'',imported:s.imported?.name||s.imported?.value||'default'}))});
      refs.push({from:filename,relation:'js:import',ref,index:n.start});
    }
    if(n.type==='ExportNamedDeclaration'){
      if(n.declaration?.id?.name) exports.push(n.declaration.id.name);
      for(const s of n.specifiers||[]) exports.push(s.exported?.name||s.exported?.value);
    }
    if(n.type==='ExportDefaultDeclaration') exports.push('default');
    if(n.type==='VariableDeclarator' && n.id?.type==='Identifier'){
      const sel=domSelectorFromCall(n.init); if(sel) variableTargets.set(n.id.name,sel);
    }
    if(n.type==='CallExpression'){
      const name=callName(n.callee);
      const sel=domSelectorFromCall(n); if(sel) domRefs.push({file:filename,selector:sel,kind:'query',index:n.start});
      if(['fetch','importScripts'].includes(name)){
        const ref=literalValue(n.arguments?.[0]); if(ref) refs.push({from:filename,relation:`js:${name}`,ref,index:n.start});
      }
      if(/\.addEventListener$/.test(name)){
        const event=literalValue(n.arguments?.[0]); let target=null;
        const obj=n.callee.object; target=domSelectorFromCall(obj) || (obj?.type==='Identifier'?variableTargets.get(obj.name):null);
        if(target && event) domListeners.push({file:filename,target,event,index:n.start});
      }
      if(/(?:^|\.)emit$/.test(name)){
        const event=literalValue(n.arguments?.[0]); if(event) busEmits.push({file:filename,bus:name.replace(/\.emit$/,''),event,index:n.start});
      }
      if(/(?:^|\.)on$/.test(name)){
        const event=literalValue(n.arguments?.[0]); if(event) busListens.push({file:filename,bus:name.replace(/\.on$/,''),event,index:n.start});
      }
      if(name.endsWith('.dispatchEvent')){
        const a=n.arguments?.[0]; if(a?.type==='NewExpression' && ['CustomEvent','Event'].includes(callName(a.callee))){
          const event=literalValue(a.arguments?.[0]); if(event) busEmits.push({file:filename,bus:name.replace(/\.dispatchEvent$/,''),event,index:n.start});
        }
      }
    }
    if(n.type==='AssignmentExpression' && n.left?.type==='MemberExpression'){
      const prop=memberName(n.left); if(/^on[a-z]+$/i.test(prop)){
        const obj=n.left.object; const target=domSelectorFromCall(obj)||(obj?.type==='Identifier'?variableTargets.get(obj.name):null);
        if(target) domListeners.push({file:filename,target,event:prop.slice(2).toLowerCase(),index:n.start});
      }
    }
    if(n.type==='NewExpression'){
      const name=callName(n.callee); if(['Worker','SharedWorker','Audio'].includes(name)){
        const ref=literalValue(n.arguments?.[0]); if(ref) refs.push({from:filename,relation:`js:new-${name.toLowerCase()}`,ref,index:n.start});
      }
    }
  });
  return {refs,domRefs,domListeners,busEmits,busListens,exports:[...new Set(exports)],imports};
}
function entrypointNames(assets){
  const names=new Set();
  for(const a of assets){ const n=normalizePath(a.name||''); if(/(^|\/)index\.html?$/i.test(n)) names.add(n); }
  const pkg=assets.find(a=>/(^|\/)package\.json$/i.test(normalizePath(a.name||'')));
  if(pkg?.text){ try { const p=JSON.parse(pkg.text); for(const k of ['main','module','browser']) if(typeof p[k]==='string') names.add(normalizePath(p[k])); } catch {} }
  if(!names.size){
    const first=assets.find(a=>HTML_EXT.test(a.name||''))||assets.find(a=>JS_EXT.test(a.name||'')); if(first) names.add(normalizePath(first.name));
  }
  return names;
}

export function buildAssetGraph(rawAssets=[]){
  const assets=rawAssets.map(a=>({name:normalizePath(a.name||a.filename||'asset'),type:a.type||'',kind:extKind(a.name||a.filename||'',a.type||'',a.kind||''),text:typeof a.code==='string'?a.code:(a.text||''),size:a.size??(a.text||a.code||'').length}));
  const known=new Set(assets.map(a=>a.name)); const entries=entrypointNames(assets);
  const nodes=assets.map(a=>({id:`file:${a.name}`,type:'file',name:a.name,kind:a.kind,mime:a.type||'',bytes:a.size||0,entrypoint:entries.has(a.name)}));
  const edges=[], html={ids:new Map(),classes:new Map(),controls:[]}, css={selectors:[]}, js={domRefs:[],domListeners:[],busEmits:[],busListens:[],exports:new Map(),imports:new Map()}, errors=[];
  const addDom=(map,key,file)=>{ const list=map.get(key)||[]; if(!list.includes(file)) list.push(file); map.set(key,list); };
  for(const a of assets){
    try{
      let extracted={refs:[]};
      if(HTML_EXT.test(a.name)){
        extracted=extractHtml(a.text,a.name); for(const id of extracted.ids) addDom(html.ids,id,a.name); for(const c of extracted.classes) addDom(html.classes,c,a.name); html.controls.push(...extracted.controls);
      } else if(CSS_EXT.test(a.name)){
        extracted=extractCss(a.text,a.name); css.selectors.push(...extracted.selectors.map(selector=>({file:a.name,selector})));
      } else if(JS_EXT.test(a.name)){
        extracted=extractJs(a.text,a.name); js.domRefs.push(...extracted.domRefs); js.domListeners.push(...extracted.domListeners); js.busEmits.push(...extracted.busEmits); js.busListens.push(...extracted.busListens); js.exports.set(a.name,extracted.exports); js.imports.set(a.name,extracted.imports);
      }
      for(const r of extracted.refs||[]){
        const rr=resolveReference(a.name,r.ref,known);
        edges.push({from:a.name,to:r.ref,relation:r.relation,external:rr.external,resolved:rr.resolved,target:rr.target,index:r.index??null});
      }
    } catch(e){ errors.push({file:a.name,type:'parse',message:e.message}); }
  }
  const incoming=new Map(assets.map(a=>[a.name,0]));
  for(const e of edges) if(e.resolved) incoming.set(e.resolved,(incoming.get(e.resolved)||0)+1);
  return {
    nodes,edges,errors,entrypoints:[...entries],incoming:Object.fromEntries(incoming),
    html:{ids:Object.fromEntries(html.ids),classes:Object.fromEntries(html.classes),controls:html.controls},
    css,js:{...js,exports:Object.fromEntries(js.exports),imports:Object.fromEntries(js.imports)},
    summary:{assets:nodes.length,edges:edges.length,entrypoints:entries.size,unresolved:edges.filter(e=>!e.external&&!e.resolved).length,domTargets:html.ids.size,controls:html.controls.length}
  };
}

export { normalizePath, resolveReference, extractHtml, extractCss, extractJs };

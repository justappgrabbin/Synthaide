import { ASTProjectRewriter } from '../ast/ASTProjectRewriter.mjs';
import { stableId } from '../utils/hash.mjs';
import { relativeImport } from './InterfaceInference.mjs';

function normalize(a={}){ return {name:a.name||a.filename||'file',type:a.type||'',kind:a.kind||'',text:typeof a.code==='string'?a.code:(a.text||'')}; }
function escString(x){ return JSON.stringify(String(x)); }
function marker(id){ return `data-morph-bridge-${String(id).replace(/[^a-z0-9_-]/gi,'-')}`; }
function bindControlCode(contract){
  const {source,target}=contract; const attr=marker(contract.id);
  const call=target.params>0?`${target.name}(event);`:`${target.name}();`;
  return `\n// Morph Bridge ${contract.id}: ${source.selector} -> ${target.name}\n(()=>{\n  const bind=()=>{\n    const el=document.querySelector(${escString(source.selector)});\n    if(!el || el.hasAttribute(${escString(attr)})) return;\n    el.setAttribute(${escString(attr)},'1');\n    el.addEventListener(${escString(source.event||'click')}, event=>{ ${source.event==='submit'?'event.preventDefault(); ':''}${call} });\n  };\n  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();\n})();\n`;
}
function controlToEventCode(contract){
  const {source,target}=contract; const attr=marker(contract.id);
  return `\n// Morph Bridge ${contract.id}: ${source.selector} -> ${target.bus}.emit(${escString(target.event)})\n(()=>{\n  const bind=()=>{\n    const el=document.querySelector(${escString(source.selector)});\n    if(!el || el.hasAttribute(${escString(attr)})) return;\n    el.setAttribute(${escString(attr)},'1');\n    el.addEventListener(${escString(source.event||'click')}, event=>{ ${source.event==='submit'?'event.preventDefault(); ':''}${target.bus}.emit(${escString(target.event)},{event,target:event.currentTarget}); });\n  };\n  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();\n})();\n`;
}
function eventToFunctionCode(contract, localName){
  const {source,target}=contract;
  const call=target.params>0?`${localName}(payload);`:`${localName}();`;
  return `\n// Morph Bridge ${contract.id}: ${source.bus}.on(${escString(source.event)}) -> ${target.name}\n${source.bus}.on(${escString(source.event)}, payload=>{ ${call} });\n`;
}
function overlay(base,candidates){
  const map=new Map(base.map(a=>{const n=normalize(a);return [n.name,n];}));
  for(const a of candidates){const n=normalize(a);map.set(n.name,n);} return [...map.values()];
}

export class BridgeBuilder {
  constructor({rewriter}={}){ this.rewriter=rewriter||new ASTProjectRewriter(); }
  build(contract,assets=[]){
    if(!contract?.supported) return {kind:'interface-bridge',built:false,contract,files:[],reason:'Interface contract is not safe enough to build automatically.'};
    const byName=new Map(assets.map(a=>{const n=normalize(a);return [n.name,n];}));
    const files=[]; let operation='';

    if(contract.strategy==='control-to-function'){
      const target=byName.get(contract.target.file); if(!target) throw new Error(`Missing target file: ${contract.target.file}`);
      files.push({...target,text:target.text+bindControlCode(contract)}); operation='append-control-handler';
    }
    else if(contract.strategy==='control-to-event'){
      const target=byName.get(contract.target.file); if(!target) throw new Error(`Missing event consumer file: ${contract.target.file}`);
      files.push({...target,text:target.text+controlToEventCode(contract)}); operation='append-event-producer';
    }
    else if(contract.strategy==='event-to-function'){
      const source=byName.get(contract.source.file); if(!source) throw new Error(`Missing emitter file: ${contract.source.file}`);
      let code=source.text; let localName=contract.target.name;
      if(contract.target.file!==contract.source.file){
        if(!contract.target.exported || contract.source.sourceType!=='module') throw new Error('Cross-file event bridge requires an exported target and module emitter.');
        const importPath=relativeImport(contract.source.file,contract.target.file);
        localName=`__morphBridge_${contract.target.name}_${stableId('x',contract.id).slice(-4)}`;
        code=`import { ${contract.target.name} as ${localName} } from ${escString(importPath)};\n`+code;
      }
      code+=eventToFunctionCode(contract,localName);
      files.push({...source,text:code}); operation='append-event-consumer';
    }
    else if(contract.strategy==='rewrite-import'){
      const source=byName.get(contract.source.file); if(!source) throw new Error(`Missing import source file: ${contract.source.file}`);
      const result=this.rewriter.rewrite([source],{imports:{[contract.source.reference]:contract.target.newSource}});
      if(!result.verified||!result.outputs?.length) throw new Error(result.errors?.[0]?.error||'Import rewrite failed');
      files.push({...source,text:result.outputs[0].code}); operation='rewrite-import';
    }
    else return {kind:'interface-bridge',built:false,contract,files:[],reason:`Unsupported bridge strategy: ${contract.strategy}`};

    return {kind:'interface-bridge',built:true,id:stableId('bridge',{contract:contract.id,files:files.map(f=>f.name)}),contract,operation,files,previewProject:overlay(assets,files)};
  }
}

export { overlay as overlayCandidateFiles };

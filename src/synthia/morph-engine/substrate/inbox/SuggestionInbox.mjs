import { stableId } from '../utils/hash.mjs';

class MemoryStore {
  constructor(){ this.map=new Map(); }
  getItem(k){ return this.map.has(k)?this.map.get(k):null; }
  setItem(k,v){ this.map.set(k,String(v)); }
}

function defaultStore(){
  try { if(typeof localStorage!=='undefined') return localStorage; } catch {}
  return new MemoryStore();
}

function clone(x){ return JSON.parse(JSON.stringify(x)); }
function now(){ return new Date().toISOString(); }

function normalizeSuggestion(input={}) {
  const seed=JSON.stringify({title:input.title,why:input.why,files:(input.files||[]).map(f=>[f.name||f.filename,(f.text||f.code||'').length]),at:input.createdAt||now()});
  const createdAt=input.createdAt||now();
  return {
    id: input.id || stableId('suggestion', seed),
    status: input.status || 'pending',
    category: input.category || 'candidate-change',
    installable: input.installable !== undefined ? !!input.installable : (input.files||[]).length>0,
    title: input.title || 'Untitled improvement',
    why: input.why || 'No rationale supplied.',
    what: input.what || 'Candidate project change.',
    does: input.does || 'No behavior description supplied.',
    expectedBenefit: input.expectedBenefit || '',
    risk: input.risk || 'unknown',
    scope: input.scope || [],
    provenance: input.provenance || {source:'morph-engine'},
    evidence: input.evidence || [],
    verification: input.verification || null,
    files: (input.files||[]).map(f=>({name:f.name||f.filename||'candidate.txt',type:f.type||'',kind:f.kind||'',text:typeof f.code==='string'?f.code:(f.text||'')})),
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    decision: input.decision || null,
    appliedAt: input.appliedAt || null
  };
}

export class SuggestionInbox {
  constructor({storage,key='synthia.morph.suggestionInbox.v1'}={}) {
    this.storage=storage||defaultStore(); this.key=key;
  }
  _read(){ try { return JSON.parse(this.storage.getItem(this.key)||'[]'); } catch { return []; } }
  _write(items){ this.storage.setItem(this.key,JSON.stringify(items)); return items; }
  list({status}={}){ const xs=this._read(); return clone(status?xs.filter(x=>x.status===status):xs); }
  get(id){ const x=this._read().find(x=>x.id===id); return x?clone(x):null; }
  submit(input){
    const suggestion=normalizeSuggestion(input);
    const items=this._read();
    if(items.some(x=>x.id===suggestion.id)) throw new Error(`Suggestion already exists: ${suggestion.id}`);
    items.unshift(suggestion); this._write(items); return clone(suggestion);
  }
  _decide(id,status,note=''){
    if(!['approved','rejected'].includes(status)) throw new Error('Invalid decision');
    const items=this._read(), i=items.findIndex(x=>x.id===id);
    if(i<0) throw new Error(`Unknown suggestion: ${id}`);
    if(items[i].status!=='pending') throw new Error(`Suggestion is already ${items[i].status}`);
    items[i]={...items[i],status,updatedAt:now(),decision:{status,note,at:now()}};
    this._write(items); return clone(items[i]);
  }
  approve(id,note=''){ return this._decide(id,'approved',note); }
  reject(id,note=''){ return this._decide(id,'rejected',note); }
  async apply(id, installer){
    const items=this._read(), i=items.findIndex(x=>x.id===id);
    if(i<0) throw new Error(`Unknown suggestion: ${id}`);
    const item=items[i];
    if(item.status!=='approved') throw new Error(`Approval required before install: ${id}`);
    if(item.installable===false || !(item.files||[]).length) throw new Error(`No installable candidate exists for suggestion: ${id}`);
    if(typeof installer!=='function') throw new Error('Installer callback required');
    const result=await installer(clone(item));
    items[i]={...item,status:'applied',appliedAt:now(),updatedAt:now(),installResult:result??null};
    this._write(items); return clone(items[i]);
  }
  remove(id){ const items=this._read().filter(x=>x.id!==id); this._write(items); }
  clear(){ this._write([]); }
}

export { MemoryStore, normalizeSuggestion };

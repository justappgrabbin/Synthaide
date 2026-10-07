function deepClone(value){ return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)); }

export class MemoryVaultStore {
  constructor(){ this.stores=new Map(); }
  _s(name){ if(!this.stores.has(name)) this.stores.set(name,new Map()); return this.stores.get(name); }
  async get(store,key){ const v=this._s(store).get(key); return v===undefined?null:deepClone(v); }
  async put(store,key,value,{overwrite=true}={}){
    const s=this._s(store);
    if(s.has(key) && (store==='originals'||store==='hashIndex'||!overwrite)) throw new Error(`Immutable record already exists: ${store}/${key}`);
    s.set(key,deepClone(value)); return deepClone(value);
  }
  async delete(store,key){ if(store==='originals'||store==='hashIndex') throw new Error(`Immutable store cannot delete: ${store}/${key}`); this._s(store).delete(key); }
  async values(store){ return [...this._s(store).values()].map(deepClone); }
  async entries(store){ return [...this._s(store).entries()].map(([k,v])=>[k,deepClone(v)]); }
}

const DB_STORES=['originals','hashIndex','sightings','policies','board','threads','lineage','tickets','settings'];
export class IndexedDBVaultStore {
  constructor({dbName='synthia.personal.vault',version=1}={}){ this.dbName=dbName; this.version=version; this.dbp=null; }
  async _db(){
    if(this.dbp) return this.dbp;
    if(typeof indexedDB==='undefined') throw new Error('IndexedDB is unavailable in this environment.');
    this.dbp=new Promise((resolve,reject)=>{
      const req=indexedDB.open(this.dbName,this.version);
      req.onupgradeneeded=()=>{ for(const s of DB_STORES) if(!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); };
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
    return this.dbp;
  }
  async _tx(store,mode,fn){ const db=await this._db(); return new Promise((resolve,reject)=>{ const tx=db.transaction(store,mode), os=tx.objectStore(store); let result; try{result=fn(os);}catch(e){reject(e);return;} tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted')); }); }
  async get(store,key){ const db=await this._db(); return new Promise((resolve,reject)=>{ const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error); }); }
  async put(store,key,value,{overwrite=true}={}){
    const exists=await this.get(store,key)!==null;
    if(exists && (store==='originals'||store==='hashIndex'||!overwrite)) throw new Error(`Immutable record already exists: ${store}/${key}`);
    const db=await this._db(); return new Promise((resolve,reject)=>{ const tx=db.transaction(store,'readwrite'),r=tx.objectStore(store).put(value,key);r.onsuccess=()=>resolve(value);r.onerror=()=>reject(r.error); });
  }
  async delete(store,key){ if(store==='originals'||store==='hashIndex') throw new Error(`Immutable store cannot delete: ${store}/${key}`); return this._tx(store,'readwrite',os=>os.delete(key)); }
  async values(store){ const db=await this._db(); return new Promise((resolve,reject)=>{ const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error); }); }
  async entries(store){ const db=await this._db(); return new Promise((resolve,reject)=>{ const tx=db.transaction(store,'readonly'),os=tx.objectStore(store),keys=os.getAllKeys(),vals=os.getAll(); let k,v; keys.onsuccess=()=>{k=keys.result;if(v)resolve(k.map((x,i)=>[x,v[i]]));}; vals.onsuccess=()=>{v=vals.result;if(k)resolve(k.map((x,i)=>[x,v[i]]));}; keys.onerror=vals.onerror=()=>reject(keys.error||vals.error); }); }
}

export function defaultVaultStore(){ return typeof indexedDB!=='undefined'?new IndexedDBVaultStore():new MemoryVaultStore(); }

import { defaultVaultStore } from './VaultStore.mjs';
import { readBytes, sha256Hex, randomId, cloneBytes } from './crypto.mjs';
import { organizeArtifact, similarity } from './organize.mjs';

const TIERS=new Set(['core','important','archive','derivative','temp']);
function now(){return new Date().toISOString();}
function cleanMeta(x){ const y={...x}; delete y.bytes; delete y.file; delete y.arrayBuffer; delete y.text; return y; }
function nameOf(input,meta){ return meta.name||input?.name||'untitled'; }
function typeOf(input,meta){ return meta.type||input?.type||''; }

export class PersonalVault {
  constructor({store=defaultVaultStore()}={}){ this.store=store; }
  async preserve(input,meta={}){
    const bytes=await readBytes(input), hash=await sha256Hex(bytes), existing=await this.store.get('hashIndex',hash);
    const seen={id:randomId('seen'),hash,at:now(),source:meta.source||'manual',path:meta.path||input?.webkitRelativePath||input?.name||'',name:nameOf(input,meta),size:bytes.byteLength};
    if(existing){
      const sightings=await this.store.get('sightings',existing)||[]; sightings.push(seen); await this.store.put('sightings',existing,sightings);
      return {status:'duplicate',original:await this.get(existing),sighting:seen};
    }
    const id=`orig_${hash.slice(0,24)}`, tier=TIERS.has(meta.tier)?meta.tier:'important';
    const original={
      id,kind:'immutable-original',hash,algorithm:'SHA-256',name:nameOf(input,meta),type:typeOf(input,meta),size:bytes.byteLength,
      bytes:cloneBytes(bytes),firstSeenAt:seen.at,source:meta.source||'manual',path:seen.path,
      organization:organizeArtifact({name:nameOf(input,meta),type:typeOf(input,meta),path:seen.path}),
      provenance:{...cleanMeta(meta),source:meta.source||'manual',firstSeenPath:seen.path},
      immutable:true
    };
    await this.store.put('originals',id,original,{overwrite:false});
    await this.store.put('hashIndex',hash,id,{overwrite:false});
    await this.store.put('sightings',id,[seen]);
    await this.store.put('policies',id,{artifactId:id,tier,pinned:tier==='core',updatedAt:now()});
    await this.store.put('lineage',id,{id,kind:'original',parents:meta.parents||[],createdAt:seen.at,createdBy:meta.createdBy||'user',reason:meta.reason||'preserved first-seen artifact'});
    return {status:'preserved',original:await this.get(id),sighting:seen};
  }
  async get(id,{includeBytes=false}={}){
    const x=await this.store.get('originals',id); if(!x)return null;
    const policy=await this.store.get('policies',id), sightings=await this.store.get('sightings',id)||[];
    const out={...x,policy,sightings}; if(!includeBytes) delete out.bytes; return out;
  }
  async bytes(id){ const x=await this.store.get('originals',id); if(!x)throw new Error(`Unknown vault artifact: ${id}`); return cloneBytes(x.bytes); }
  async list(){ const xs=await this.store.values('originals'); const out=[]; for(const x of xs) out.push(await this.get(x.id)); return out.sort((a,b)=>b.firstSeenAt.localeCompare(a.firstSeenAt)); }
  async search(query=''){
    const q=String(query).trim().toLowerCase(), xs=await this.list(); if(!q)return xs;
    return xs.filter(x=>[x.name,x.path,x.organization?.topic,x.organization?.collection,...(x.organization?.keywords||[])].join(' ').toLowerCase().includes(q));
  }
  async setTier(id,tier,{pinned}={}){
    if(!TIERS.has(tier)) throw new Error(`Unknown preservation tier: ${tier}`);
    if(!await this.store.get('originals',id)) throw new Error(`Unknown vault artifact: ${id}`);
    const prev=await this.store.get('policies',id)||{artifactId:id};
    const next={...prev,tier,pinned:pinned??(tier==='core'||prev.pinned||false),updatedAt:now()}; await this.store.put('policies',id,next); return next;
  }
  async createWorkCopy(originalId,{purpose='work',createdBy='user',title}={}){
    const original=await this.store.get('originals',originalId); if(!original)throw new Error(`Unknown vault artifact: ${originalId}`);
    const id=randomId('work'), item={id,kind:'work-copy',sourceOriginalId:originalId,parentIds:[originalId],name:original.name,title:title||original.name,type:original.type,size:original.size,bytes:cloneBytes(original.bytes),purpose,createdBy,createdAt:now(),updatedAt:now(),status:'working',revision:0};
    await this.store.put('board',id,item,{overwrite:false}); return this.getWorkCopy(id);
  }
  async getWorkCopy(id,{includeBytes=false}={}){ const x=await this.store.get('board',id); if(!x)return null; const y={...x}; if(!includeBytes)delete y.bytes; return y; }
  async listWorkboard(){ const xs=await this.store.values('board'); return xs.map(x=>{const y={...x};delete y.bytes;return y;}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
  async updateWorkCopy(id,input,{name,type,reason,createdBy='user'}={}){
    const item=await this.store.get('board',id); if(!item)throw new Error(`Unknown work copy: ${id}`);
    const bytes=await readBytes(input), next={...item,bytes:cloneBytes(bytes),size:bytes.byteLength,name:name||item.name,type:type||item.type,revision:(item.revision||0)+1,updatedAt:now(),lastChange:{at:now(),reason:reason||'edited work copy',createdBy}};
    await this.store.put('board',id,next); return this.getWorkCopy(id);
  }
  async archiveWorkCopy(id,{reason='accepted derivative',createdBy='user',tier='derivative'}={}){
    const item=await this.store.get('board',id); if(!item)throw new Error(`Unknown work copy: ${id}`);
    const result=await this.preserve(item.bytes,{name:item.name,type:item.type,source:'workboard',tier,parents:item.parentIds||[item.sourceOriginalId],reason,createdBy});
    if(result.status==='preserved'){
      const lin=await this.store.get('lineage',result.original.id); await this.store.put('lineage',result.original.id,{...lin,parents:item.parentIds||[item.sourceOriginalId],workCopyId:id,reason,createdBy});
    }
    await this.store.put('board',id,{...item,status:'submitted',submittedArtifactId:result.original.id,updatedAt:now()});
    return result;
  }
  async lineage(id){
    const all=await this.store.values('lineage'), byId=new Map(all.map(x=>[x.id,x])), root=byId.get(id); if(!root)return null;
    const children=all.filter(x=>(x.parents||[]).includes(id)); return {node:root,children};
  }
  async related(id,{limit=8}={}){
    const target=await this.get(id); if(!target)return [];
    const xs=(await this.list()).filter(x=>x.id!==id).map(x=>({artifact:x,score:similarity(target,x)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
    return xs;
  }
  async createThread({title,topic='',artifactIds=[],createdBy='user'}={}){
    const id=randomId('thread'), thread={id,title:title||topic||'Artifact topic',topic,artifactIds:[...new Set(artifactIds)],createdBy,createdAt:now(),updatedAt:now(),posts:[]}; await this.store.put('threads',id,thread,{overwrite:false}); return thread;
  }
  async post(threadId,{body='',createdBy='user',attachments=[]}={}){
    const t=await this.store.get('threads',threadId); if(!t)throw new Error(`Unknown thread: ${threadId}`);
    const p={id:randomId('post'),body,createdBy,attachments,createdAt:now()}; t.posts.push(p); t.updatedAt=now(); for(const a of attachments) if(a.artifactId&&!t.artifactIds.includes(a.artifactId))t.artifactIds.push(a.artifactId); await this.store.put('threads',threadId,t); return p;
  }
  async threads(){ return (await this.store.values('threads')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
  async submitContribution(workCopyId,{threadId,body='Submitted workboard contribution',createdBy='user',reason='submitted contribution'}={}){
    const archived=await this.archiveWorkCopy(workCopyId,{reason,createdBy,tier:'derivative'});
    if(threadId) await this.post(threadId,{body,createdBy,attachments:[{artifactId:archived.original.id,workCopyId}]});
    return {artifact:archived.original,threadId:threadId||null,workCopyId};
  }
  async stats(){ const originals=await this.list(), board=await this.listWorkboard(), threads=await this.threads(); return {originals:originals.length,originalBytes:originals.reduce((n,x)=>n+x.size,0),workCopies:board.length,threads:threads.length,plan:'local-free',appImposedQuota:null}; }
}

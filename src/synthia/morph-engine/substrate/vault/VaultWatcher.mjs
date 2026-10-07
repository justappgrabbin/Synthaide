export async function* walkDirectory(handle,prefix=''){
  for await(const [name,entry] of handle.entries()){
    const path=prefix?`${prefix}/${name}`:name;
    if(entry.kind==='file') yield {path,file:await entry.getFile()};
    else if(entry.kind==='directory') yield* walkDirectory(entry,path);
  }
}

export class VaultWatcher {
  constructor({vault,intervalMs=15000,onEvent=()=>{}}={}){ if(!vault)throw new Error('VaultWatcher requires a vault'); this.vault=vault;this.intervalMs=intervalMs;this.onEvent=onEvent;this.roots=new Map();this.timer=null;this.scanning=false; }
  mount(handle,{label=handle?.name||'folder'}={}){ if(!handle||handle.kind!=='directory')throw new Error('A File System Access directory handle is required'); this.roots.set(label,handle); return label; }
  unmount(label){ this.roots.delete(label); }
  async scan(){
    if(this.scanning)return {skipped:true}; this.scanning=true; const results=[];
    try{
      for(const [label,handle] of this.roots){
        if(handle.queryPermission){ let p=await handle.queryPermission({mode:'read'}); if(p!=='granted'&&handle.requestPermission)p=await handle.requestPermission({mode:'read'}); if(p!=='granted'){results.push({root:label,status:'permission-denied'});continue;} }
        for await(const {path,file} of walkDirectory(handle)){
          const watchKey=`watch:${label}:${path}`, previous=await this.vault.store.get('settings',watchKey);
          const stamp={size:file.size,lastModified:file.lastModified||0,type:file.type||''};
          if(previous && previous.size===stamp.size && previous.lastModified===stamp.lastModified && previous.type===stamp.type){ results.push({root:label,path,status:'unchanged',artifactId:previous.artifactId}); continue; }
          const r=await this.vault.preserve(file,{source:`watch:${label}`,path});
          await this.vault.store.put('settings',watchKey,{...stamp,artifactId:r.original.id,scannedAt:new Date().toISOString()});
          results.push({root:label,path,status:r.status,artifactId:r.original.id}); if(r.status==='preserved')this.onEvent({type:'preserved',root:label,path,artifact:r.original});
        }
      }
      return {scannedAt:new Date().toISOString(),results};
    } finally { this.scanning=false; }
  }
  start(){ if(this.timer)return; this.timer=setInterval(()=>this.scan().catch(e=>this.onEvent({type:'error',error:e})),this.intervalMs); }
  stop(){ if(this.timer)clearInterval(this.timer);this.timer=null; }
}

export async function preserveFileList(vault,fileList,{source='folder-upload'}={}){
  const results=[]; for(const file of [...fileList]) results.push(await vault.preserve(file,{source,path:file.webkitRelativePath||file.name})); return results;
}

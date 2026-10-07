export class IdleSuggestionScout {
  constructor({pipeline,getInputs,getIntents,isIdle=()=>true,maxPending=8,onSuggestion=()=>{},onError=()=>{}}={}) {
    if(!pipeline) throw new Error('IdleSuggestionScout requires a SuggestionPipeline');
    if(typeof getInputs!=='function') throw new Error('getInputs callback required');
    if(typeof getIntents!=='function') throw new Error('getIntents callback required');
    this.pipeline=pipeline; this.getInputs=getInputs; this.getIntents=getIntents; this.isIdle=isIdle;
    this.maxPending=maxPending; this.onSuggestion=onSuggestion; this.onError=onError; this.timer=null; this.running=false;
  }
  async tick(){
    if(this.running || !this.isIdle()) return null;
    if(this.pipeline.inbox.list({status:'pending'}).length>=this.maxPending) return null;
    const intents=await this.getIntents();
    const list=Array.isArray(intents)?intents:[intents].filter(Boolean);
    if(!list.length) return null;
    const existing=new Set(this.pipeline.inbox.list().map(x=>x.provenance?.prompt).filter(Boolean));
    const next=list.find(x=>!existing.has(x.intent?.prompt||x.prompt||''));
    if(!next) return null;
    this.running=true;
    try {
      const inputs=await this.getInputs();
      const intent=next.intent||next;
      const meta={...(next.meta||{}),createdBy:next.meta?.createdBy||'idle-scout'};
      const suggestion=await this.pipeline.propose(inputs,intent,meta);
      this.onSuggestion(suggestion); return suggestion;
    } catch(e){ this.onError(e); return null; }
    finally { this.running=false; }
  }
  start(intervalMs=60000){
    if(this.timer) return this;
    this.timer=setInterval(()=>this.tick(),Math.max(1000,intervalMs));
    return this;
  }
  stop(){ if(this.timer) clearInterval(this.timer); this.timer=null; return this; }
}

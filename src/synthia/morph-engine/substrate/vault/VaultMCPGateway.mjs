import { randomId } from './crypto.mjs';
function nowMs(){return Date.now();}
export class VaultMCPGateway {
  constructor({vault,store=vault?.store}={}){ if(!vault)throw new Error('VaultMCPGateway requires a vault');this.vault=vault;this.store=store; }
  async issueTicket({tool='mcp',permissions=[],artifactIds=[],boardIds=[],ttlMs=30*60*1000,maxBytes=100*1024*1024}={}){
    const id=randomId('cap'), t={id,tool,permissions:[...new Set(permissions)],artifactIds:[...new Set(artifactIds)],boardIds:[...new Set(boardIds)],issuedAt:new Date().toISOString(),expiresAt:new Date(nowMs()+ttlMs).toISOString(),maxBytes,usedBytes:0,revoked:false}; await this.store.put('tickets',id,t,{overwrite:false}); return t;
  }
  async revoke(id){ const t=await this.store.get('tickets',id);if(!t)return false;await this.store.put('tickets',id,{...t,revoked:true,revokedAt:new Date().toISOString()});return true; }
  async _ticket(id,perm,{artifactId,boardId,bytes=0}={}){
    const t=await this.store.get('tickets',id); if(!t)throw new Error('Unknown MCP capability ticket'); if(t.revoked)throw new Error('MCP capability ticket revoked'); if(Date.parse(t.expiresAt)<=nowMs())throw new Error('MCP capability ticket expired'); if(!t.permissions.includes(perm))throw new Error(`MCP permission denied: ${perm}`);
    if(artifactId&&t.artifactIds.length&&!t.artifactIds.includes(artifactId))throw new Error(`Artifact outside MCP capability scope: ${artifactId}`);
    if(boardId&&t.boardIds.length&&!t.boardIds.includes(boardId))throw new Error(`Board item outside MCP capability scope: ${boardId}`);
    if(t.usedBytes+bytes>t.maxBytes)throw new Error('MCP capability byte limit exceeded');
    if(bytes){t.usedBytes+=bytes;await this.store.put('tickets',id,t);} return t;
  }
  async search(ticketId,query){ await this._ticket(ticketId,'vault.search'); return this.vault.search(query); }
  async metadata(ticketId,artifactId){ await this._ticket(ticketId,'vault.metadata.read',{artifactId}); return this.vault.get(artifactId); }
  async copyToBoard(ticketId,artifactId,{purpose='MCP workspace',createdBy}={}){
    const meta=await this.vault.get(artifactId); if(!meta)throw new Error(`Unknown vault artifact: ${artifactId}`); const t=await this._ticket(ticketId,'vault.copyToBoard',{artifactId,bytes:meta.size});
    return this.vault.createWorkCopy(artifactId,{purpose,createdBy:createdBy||t.tool});
  }
  async readBoard(ticketId,boardId){ const item=await this.vault.getWorkCopy(boardId);if(!item)throw new Error(`Unknown board item: ${boardId}`);await this._ticket(ticketId,'board.read',{boardId,bytes:item.size});return this.vault.getWorkCopy(boardId,{includeBytes:true}); }
  async writeBoard(ticketId,boardId,input,meta={}){ await this._ticket(ticketId,'board.write',{boardId});return this.vault.updateWorkCopy(boardId,input,meta); }
  async submitBoard(ticketId,boardId,meta={}){ await this._ticket(ticketId,'board.submit',{boardId});return this.vault.archiveWorkCopy(boardId,meta); }
}

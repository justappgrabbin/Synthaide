function asUint8(value){
  if(value instanceof Uint8Array) return value;
  if(value instanceof ArrayBuffer) return new Uint8Array(value);
  if(ArrayBuffer.isView(value)) return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  if(typeof value==='string') return new TextEncoder().encode(value);
  throw new TypeError('Unsupported byte source');
}

export async function readBytes(input){
  if(input==null) return new Uint8Array();
  if(input instanceof Uint8Array || input instanceof ArrayBuffer || ArrayBuffer.isView(input)) return asUint8(input);
  if(typeof Blob!=='undefined' && input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
  if(input.bytes) return readBytes(input.bytes);
  if(input.file && typeof input.file.arrayBuffer==='function') return new Uint8Array(await input.file.arrayBuffer());
  if(typeof input.arrayBuffer==='function') return new Uint8Array(await input.arrayBuffer());
  if(typeof input.text==='string') return new TextEncoder().encode(input.text);
  if(typeof input==='string') return new TextEncoder().encode(input);
  return new TextEncoder().encode(JSON.stringify(input));
}

export async function sha256Hex(input){
  const bytes=await readBytes(input);
  const subtle=globalThis.crypto?.subtle;
  if(!subtle) throw new Error('SHA-256 requires Web Crypto (crypto.subtle).');
  const digest=await subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export function randomId(prefix='id'){
  const uuid=globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export function cloneBytes(bytes){ return new Uint8Array(asUint8(bytes)); }

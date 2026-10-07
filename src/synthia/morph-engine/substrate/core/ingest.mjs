import { classifyAsset } from './classify.mjs';

export async function ingest(inputs) {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  const out = [];
  for (const item of list) {
    if (typeof item === 'string') {
      const asset = { name:'input.txt', type:'text/plain', size:item.length, text:item };
      asset.kind = classifyAsset(asset); out.push(asset); continue;
    }
    if (item && typeof item.text === 'string') {
      const asset = { name:item.name||'input.txt', type:item.type||'', size:item.size||item.text.length, text:item.text, object:item.object, file:item.file };
      asset.kind = item.kind || classifyAsset(asset); out.push(asset); continue;
    }
    if (item && typeof item.text === 'function') {
      const type = item.type || '';
      const isTextish = type.startsWith('text/') || /\.(html?|css|js|mjs|cjs|ts|tsx|jsx|json|md|txt|csv|ya?ml|svg)$/i.test(item.name||'');
      let text = '';
      if (isTextish) { try { text = await item.text(); } catch {} }
      const asset = { name:item.name||'file', type, size:item.size||0, text, file:item };
      asset.kind = classifyAsset(asset); out.push(asset); continue;
    }
    const asset = { name:item?.name||'object.json', type:'application/json', size:0, text:JSON.stringify(item ?? null, null, 2), object:item };
    asset.kind = classifyAsset(asset); out.push(asset);
  }
  return out;
}

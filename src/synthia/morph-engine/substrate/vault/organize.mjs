const STOP=new Set(['final','copy','new','old','the','and','for','with','from','this','that','file','files','version','ver']);
function tokens(text=''){
  return String(text).toLowerCase().replace(/\.[a-z0-9]{1,8}$/i,'').split(/[^a-z0-9]+/).filter(x=>x.length>1&&!STOP.has(x));
}
function ext(name=''){ const m=String(name).toLowerCase().match(/\.([a-z0-9]{1,8})$/); return m?.[1]||''; }
export function artifactCategory({name='',type=''}={}){
  const e=ext(name), t=String(type).toLowerCase();
  if(t.startsWith('image/')||['png','jpg','jpeg','gif','webp','svg','bmp','ico'].includes(e)) return 'image';
  if(t.startsWith('audio/')||['mp3','wav','ogg','m4a','aac','flac'].includes(e)) return 'audio';
  if(t.startsWith('video/')||['mp4','webm','mov','mkv'].includes(e)) return 'video';
  if(['js','mjs','cjs','ts','tsx','jsx','html','htm','css','py','java','rs','go','cpp','c','h'].includes(e)) return 'code';
  if(['zip','tar','gz','tgz','7z','rar','apk'].includes(e)) return 'archive';
  if(['json','csv','yaml','yml','xml','toml','ini'].includes(e)) return 'data';
  if(['md','txt','pdf','doc','docx','rtf','odt'].includes(e)||t.startsWith('text/')) return 'document';
  return 'other';
}
export function organizeArtifact(meta={}){
  const pathTokens=tokens(meta.path||'');
  const nameTokens=tokens(meta.name||'');
  const category=artifactCategory(meta);
  const topicTokens=[...new Set([...pathTokens.slice(-3),...nameTokens])].slice(0,6);
  const topic=topicTokens.slice(0,3).join(' ') || category;
  return {category,topic,keywords:topicTokens,collection:`${category}/${topic}`};
}
export function similarity(a={},b={}){
  const A=new Set(a.organization?.keywords||tokens(a.name)), B=new Set(b.organization?.keywords||tokens(b.name));
  const inter=[...A].filter(x=>B.has(x)).length, union=new Set([...A,...B]).size||1;
  let score=inter/union;
  if(a.organization?.category && a.organization.category===b.organization?.category) score+=.15;
  return Math.min(1,score);
}

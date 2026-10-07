const EXT = {
  image: ['png','jpg','jpeg','webp','gif','bmp','svg'],
  website: ['html','htm','css'],
  code: ['js','mjs','cjs','ts','tsx','jsx','json'],
  text: ['txt','md','csv','yaml','yml'],
  game: ['tmx','tsx','unity','godot','love','p8']
};

export function classifyAsset(asset) {
  const name = (asset.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const text = typeof asset.text === 'string' ? asset.text : '';
  if (EXT.image.includes(ext) || (asset.type || '').startsWith('image/')) return 'image';
  if (EXT.website.includes(ext) || /<html|<body|<div|<!doctype/i.test(text)) return 'website';
  if (EXT.game.includes(ext) || /\b(game|player|enemy|score|level|update\(|requestAnimationFrame|phaser|three\.)\b/i.test(text)) return 'game';
  if (EXT.code.includes(ext) || /\b(function|class|const|let|import|export)\b/.test(text)) return 'code';
  if (EXT.text.includes(ext) || text) return 'text';
  return 'binary';
}

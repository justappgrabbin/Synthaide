export function hashString(input = '') {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function stableId(prefix, payload) {
  return `${prefix}_${hashString(JSON.stringify(payload))}`;
}

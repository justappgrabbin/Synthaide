export function walk(node, visitor, parent=null, key=null) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node, parent, key);
  for (const [k,v] of Object.entries(node)) {
    if (k === 'parent' || k === 'loc') continue;
    if (Array.isArray(v)) {
      for (const child of v) if (child && typeof child === 'object') walk(child, visitor, node, k);
    } else if (v && typeof v === 'object' && typeof v.type === 'string') {
      walk(v, visitor, node, k);
    }
  }
}

export function patternNames(pattern, out=[]) {
  if (!pattern) return out;
  switch (pattern.type) {
    case 'Identifier': out.push(pattern); break;
    case 'RestElement': patternNames(pattern.argument, out); break;
    case 'AssignmentPattern': patternNames(pattern.left, out); break;
    case 'ArrayPattern': for (const e of pattern.elements) patternNames(e, out); break;
    case 'ObjectPattern':
      for (const p of pattern.properties) {
        if (p.type === 'RestElement') patternNames(p.argument, out);
        else patternNames(p.value, out);
      }
      break;
  }
  return out;
}

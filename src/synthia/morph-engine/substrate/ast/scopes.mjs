import { patternNames } from './walk.mjs';

class Scope {
  constructor(type, node, parent=null) {
    this.type=type; this.node=node; this.parent=parent; this.bindings=new Map(); this.children=[];
    if (parent) parent.children.push(this);
  }
  add(idNode, kind='unknown') {
    if (!idNode || idNode.type!=='Identifier') return null;
    let b=this.bindings.get(idNode.name);
    if (!b) {
      b={name:idNode.name, kind, declarations:[], references:[], scope:this, start:idNode.start};
      this.bindings.set(idNode.name,b);
    }
    b.declarations.push(idNode);
    return b;
  }
  resolve(name) { return this.bindings.get(name) || this.parent?.resolve(name) || null; }
  nearestVarScope(){ let s=this; while(s.parent && !['function','program'].includes(s.type)) s=s.parent; return s; }
}

function isReferenceIdentifier(node,parent,key){
  if (!parent) return false;
  if (parent.type==='VariableDeclarator' && key==='id') return false;
  if ((parent.type==='FunctionDeclaration'||parent.type==='FunctionExpression'||parent.type==='ClassDeclaration'||parent.type==='ClassExpression') && key==='id') return false;
  if ((parent.type==='FunctionDeclaration'||parent.type==='FunctionExpression'||parent.type==='ArrowFunctionExpression') && key==='params') return false;
  if (parent.type==='MemberExpression' && key==='property' && !parent.computed) return false;
  if ((parent.type==='Property'||parent.type==='MethodDefinition'||parent.type==='PropertyDefinition') && key==='key' && !parent.computed && !parent.shorthand) return false;
  if (parent.type==='LabeledStatement' && key==='label') return false;
  if ((parent.type==='BreakStatement'||parent.type==='ContinueStatement') && key==='label') return false;
  if (parent.type==='ImportSpecifier'||parent.type==='ImportDefaultSpecifier'||parent.type==='ImportNamespaceSpecifier') return false;
  if (parent.type==='ExportSpecifier') return key==='local';
  if (parent.type==='CatchClause' && key==='param') return false;
  return true;
}

export function buildScopes(ast) {
  const root=new Scope('program',ast,null);
  const nodeScope=new WeakMap();
  const declarationNodes=new WeakSet();

  function declarePattern(pattern, scope, kind){
    for (const id of patternNames(pattern)) { scope.add(id,kind); declarationNodes.add(id); nodeScope.set(id,scope); }
  }
  function visit(node, scope, parent=null, key=null){
    let here=scope;
    if (node!==ast) {
      if (node.type==='FunctionDeclaration') {
        if (node.id) { scope.add(node.id,'function'); declarationNodes.add(node.id); nodeScope.set(node.id,scope); }
        here=new Scope('function',node,scope);
        for(const p of node.params) declarePattern(p,here,'param');
      } else if (node.type==='FunctionExpression'||node.type==='ArrowFunctionExpression') {
        here=new Scope('function',node,scope);
        if (node.type==='FunctionExpression' && node.id) declarePattern(node.id,here,'function-name');
        for(const p of node.params) declarePattern(p,here,'param');
      } else if (node.type==='BlockStatement' && !['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(parent?.type)) {
        here=new Scope('block',node,scope);
      } else if (node.type==='CatchClause') {
        here=new Scope('block',node,scope);
        if(node.param) declarePattern(node.param,here,'catch');
      } else if (node.type==='ClassDeclaration') {
        if(node.id){scope.add(node.id,'class'); declarationNodes.add(node.id); nodeScope.set(node.id,scope);}
        here=new Scope('class',node,scope);
      } else if (node.type==='ClassExpression') {
        here=new Scope('class',node,scope);
        if(node.id) declarePattern(node.id,here,'class-name');
      }
    }
    nodeScope.set(node,here);

    if (node.type==='VariableDeclaration') {
      const target=node.kind==='var'?here.nearestVarScope():here;
      for(const d of node.declarations) declarePattern(d.id,target,node.kind);
    } else if (node.type==='ImportDeclaration') {
      for(const s of node.specifiers) {
        here.add(s.local,'import'); declarationNodes.add(s.local); nodeScope.set(s.local,here);
      }
    }

    for(const [k,v] of Object.entries(node)){
      if(k==='loc'||k==='start'||k==='end') continue;
      if(Array.isArray(v)) {
        for(const c of v) if(c&&typeof c.type==='string') visit(c,here,node,k);
      } else if(v&&typeof v.type==='string') {
        visit(v,here,node,k);
      }
    }
  }
  visit(ast,root);

  function refs(node, scope=root, parent=null, key=null){
    const here=nodeScope.get(node)||scope;
    if(node.type==='Identifier' && !declarationNodes.has(node) && isReferenceIdentifier(node,parent,key)) {
      const b=here.resolve(node.name); if(b) b.references.push(node);
    }
    for(const [k,v] of Object.entries(node)){
      if(k==='loc'||k==='start'||k==='end') continue;
      if(Array.isArray(v)) {
        for(const c of v) if(c&&typeof c.type==='string') refs(c,here,node,k);
      } else if(v&&typeof v.type==='string') {
        refs(v,here,node,k);
      }
    }
  }
  refs(ast,root);
  return {root,nodeScope};
}

export function flattenBindings(root, filename='input.js'){
  const out=[];
  (function rec(s){
    for(const b of s.bindings.values()) out.push({
      id:`${filename}:${b.start}:${b.name}`,
      name:b.name, kind:b.kind, start:b.start,
      declarations:b.declarations, references:b.references, scope:b.scope
    });
    for(const c of s.children) rec(c);
  })(root);
  return out;
}

import { ASTProjectRewriter } from '../ast/ASTProjectRewriter.mjs';
import { rewriteFromPrompt } from '../ast/intent.mjs';

export class CodeMorpher {
  constructor(){ this.rewriter=new ASTProjectRewriter(); }
  canHandle(assets){ return assets.some(a=>['code','game','website'].includes(a.kind) && /\.(?:mjs|cjs|js)$/i.test(a.name||'')); }
  morph(assets, ctx={}){
    const graph=this.rewriter.analyze(assets);
    const rewrite=ctx.intent?.rewrite || rewriteFromPrompt(ctx.intent?.prompt||'');
    if(rewrite && (rewrite.operations?.length || rewrite.rename || rewrite.imports || rewrite.strings || rewrite.prepend || rewrite.append)) {
      return this.rewriter.rewrite(assets,rewrite);
    }
    return {
      kind:'ast-project-analysis',
      summary:'Builds a syntax-checked project graph and exposes stable symbol IDs for targeted rewrites.',
      parseable:graph.parseable,
      files:graph.files,
      edges:graph.edges,
      errors:graph.errors,
      supportedRewriteOps:['rename','rewrite-import','replace-string','prepend','append','inject-function-start','inject-function-end']
    };
  }
}

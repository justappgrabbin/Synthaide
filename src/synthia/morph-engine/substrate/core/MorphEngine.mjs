import { ingest } from './ingest.mjs';
import { extractIdentity } from './identity.mjs';
import { makePlan } from './planner.mjs';
import { TextMorpher } from '../adapters/TextMorpher.mjs';
import { SpriteMorpher } from '../adapters/SpriteMorpher.mjs';
import { WebsiteMorpher } from '../adapters/WebsiteMorpher.mjs';
import { GameMorpher } from '../adapters/GameMorpher.mjs';
import { CompositeMorpher } from '../adapters/CompositeMorpher.mjs';
import { CodeMorpher } from '../adapters/CodeMorpher.mjs';
import { buildAssetGraph } from '../graph/AssetGraph.mjs';
import { GapDetector } from '../graph/GapDetector.mjs';
import { InterfaceInference } from '../bridge/InterfaceInference.mjs';
import { BridgeBuilder } from '../bridge/BridgeBuilder.mjs';

export class MorphEngine {
  constructor({adapters,gapDetector,interfaceInference,bridgeBuilder}={}) {
    this.adapters = adapters || [new CompositeMorpher(), new SpriteMorpher(), new GameMorpher(), new WebsiteMorpher(), new CodeMorpher(), new TextMorpher()];
    this.gapDetector=gapDetector||new GapDetector();
    this.interfaceInference=interfaceInference||new InterfaceInference();
    this.bridgeBuilder=bridgeBuilder||new BridgeBuilder();
  }
  async inspect(inputs,{includeOrphans=true}={}) {
    const assets = await ingest(inputs);
    const identity = extractIdentity(assets);
    const assetGraph=buildAssetGraph(assets);
    const gaps=this.gapDetector.detect(assetGraph,{includeOrphans});
    return {assets,identity,assetGraph,gaps};
  }
  async analyze(inputs) {
    const {assets,identity}=await this.inspect(inputs);
    return {assets, identity};
  }
  async diagnose(inputs,options={}) {
    const {assets,identity,assetGraph,gaps}=await this.inspect(inputs,options);
    return {assets,identity,assetGraph,gaps};
  }
  async inferGap(inputs,gap,{includeOrphans=true}={}) {
    const inspected=await this.inspect(inputs,{includeOrphans});
    const contract=this.interfaceInference.infer(gap,inspected.assetGraph,inspected.assets);
    return {...inspected,contract};
  }
  async buildBridge(inputs,gap,{includeOrphans=true}={}) {
    const inferred=await this.inferGap(inputs,gap,{includeOrphans});
    const bridge=this.bridgeBuilder.build(inferred.contract,inferred.assets);
    return {...inferred,bridge};
  }
  async morph(inputs, intent={}) {
    const {assets, identity, assetGraph, gaps} = await this.inspect(inputs,{includeOrphans:intent.includeOrphans!==false});
    const plan = makePlan(identity, intent);
    const results = this.adapters.filter(a=>a.canHandle(assets)).map(a=>a.morph(assets,{identity,plan,intent}));
    return {identity, plan, assetGraph:{summary:assetGraph.summary,entrypoints:assetGraph.entrypoints}, gaps:gaps.summary, results};
  }
}

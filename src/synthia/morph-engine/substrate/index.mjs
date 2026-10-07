export { MorphEngine } from './core/MorphEngine.mjs';
export { convergeWebAssets } from './core/converge.mjs';
export { createSpriteMorphPlayer, SpriteMorphPlayer, inferGrid, sliceSheet, drawInterpolated } from './adapters/SpriteRuntime.mjs';

export { ASTProjectRewriter } from './ast/ASTProjectRewriter.mjs';
export { analyzeJavaScript, analyzeProject } from './ast/analyze.mjs';
export { rewriteJavaScript, applyEdits } from './ast/rewrite.mjs';
export { rewriteFromPrompt } from './ast/intent.mjs';

export { SandboxVerifier, staticVerify, runtimeVerify, buildRuntimeDocument } from './sandbox/SandboxVerifier.mjs';
export { SuggestionInbox, MemoryStore, normalizeSuggestion } from './inbox/SuggestionInbox.mjs';
export { SuggestionPipeline, candidateFiles } from './inbox/SuggestionPipeline.mjs';
export { applySuggestionToAssets } from './inbox/applySuggestion.mjs';
export { IdleSuggestionScout } from './inbox/IdleSuggestionScout.mjs';

export { buildAssetGraph, normalizePath, resolveReference, extractHtml, extractCss, extractJs } from './graph/AssetGraph.mjs';
export { GapDetector, detectGaps, gapSuggestionDraft } from './graph/GapDetector.mjs';

export { InterfaceInference, inferInterface, similarity as interfaceSimilarity, relativeImport as relativeBridgeImport } from './bridge/InterfaceInference.mjs';
export { BridgeBuilder, overlayCandidateFiles } from './bridge/BridgeBuilder.mjs';

export { PersonalVault } from './vault/PersonalVault.mjs';
export { MemoryVaultStore, IndexedDBVaultStore, defaultVaultStore } from './vault/VaultStore.mjs';
export { VaultWatcher, walkDirectory, preserveFileList } from './vault/VaultWatcher.mjs';
export { VaultMCPGateway } from './vault/VaultMCPGateway.mjs';
export { sha256Hex, readBytes } from './vault/crypto.mjs';
export { organizeArtifact, artifactCategory, similarity as vaultArtifactSimilarity } from './vault/organize.mjs';

import AdmZip from 'adm-zip';
import type {
  ModuleManifest,
  ResonanceMap,
  UserResonanceProfile,
  ModuleAssembly,
  ConsciousnessField,
} from '@shared/schema';
import {
  moduleManifestSchema,
  resonanceMapSchema,
} from '@shared/schema';

interface ExtractedModule {
  manifest: ModuleManifest;
  resonanceMap: ResonanceMap;
  files: {
    ui: string[];
    logic: string[];
    config: string[];
  };
}

export class SynthAssembler {
  private profile: UserResonanceProfile;

  constructor(profile: UserResonanceProfile) {
    this.profile = profile;
  }

  async analyzeModule(zipBuffer: Buffer): Promise<ModuleAssembly> {
    try {
      const extracted = this.extractModule(zipBuffer);
      const compatibility = this.calculateCompatibility(extracted);
      const resonanceMatch = this.calculateResonanceMatch(extracted.resonanceMap);
      const feedback = this.generateFeedback(extracted, compatibility, resonanceMatch);

      return {
        moduleId: extracted.manifest.id,
        moduleName: extracted.manifest.name,
        compatibilityScore: compatibility.score,
        status: compatibility.status,
        activatedGates: extracted.manifest.gates || [],
        resonanceMatch,
        components: extracted.files,
        feedback,
        warnings: compatibility.warnings,
        suggestions: compatibility.suggestions,
      };
    } catch (error) {
      throw new Error(`Module analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractModule(zipBuffer: Buffer): ExtractedModule {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    let manifest: ModuleManifest | null = null;
    let resonanceMap: ResonanceMap | null = null;
    const files = {
      ui: [] as string[],
      logic: [] as string[],
      config: [] as string[],
    };

    zipEntries.forEach((entry) => {
      const name = entry.entryName;

      if (name.includes('manifest.json')) {
        const content = entry.getData().toString('utf8');
        manifest = moduleManifestSchema.parse(JSON.parse(content));
      } else if (name.includes('resonance_map.json')) {
        const content = entry.getData().toString('utf8');
        resonanceMap = resonanceMapSchema.parse(JSON.parse(content));
      } else if (name.includes('ui/')) {
        files.ui.push(name);
      } else if (name.includes('logic/')) {
        files.logic.push(name);
      } else if (name.includes('config/')) {
        files.config.push(name);
      }
    });

    if (!manifest || !resonanceMap) {
      throw new Error('Invalid module structure: missing manifest or resonance map');
    }

    return { manifest, resonanceMap, files };
  }

  private calculateCompatibility(module: ExtractedModule): {
    score: number;
    status: 'compatible' | 'partial' | 'incompatible' | 'requires_update';
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    // Check coherence threshold
    if (module.resonanceMap.activationConditions?.minCoherence) {
      if (this.profile.coherence < module.resonanceMap.activationConditions.minCoherence) {
        score -= 0.3;
        warnings.push(`Your coherence (${(this.profile.coherence * 100).toFixed(0)}%) is below the recommended ${(module.resonanceMap.activationConditions.minCoherence * 100).toFixed(0)}%`);
        suggestions.push('Practice coherence exercises to unlock full module potential');
      }
    }

    // Check required gates
    if (module.resonanceMap.activationConditions?.requiredGates) {
      const missingGates = module.resonanceMap.activationConditions.requiredGates.filter(
        gate => !this.profile.activeGates.includes(gate)
      );
      if (missingGates.length > 0) {
        score -= 0.2 * (missingGates.length / module.resonanceMap.activationConditions.requiredGates.length);
        warnings.push(`Missing required gates: ${missingGates.join(', ')}`);
        suggestions.push('Activate prerequisite gates to unlock this module');
      }
    }

    // Check required fields
    if (module.manifest.requiredFields) {
      const missingFields = module.manifest.requiredFields.filter(
        field => !this.profile.activeFields.includes(field)
      );
      if (missingFields.length > 0) {
        score -= 0.15 * (missingFields.length / module.manifest.requiredFields.length);
        warnings.push(`Requires activation of: ${missingFields.join(', ')} fields`);
      }
    }

    // Check blocked modules
    if (module.resonanceMap.activationConditions?.blockedBy) {
      const conflicts = module.resonanceMap.activationConditions.blockedBy;
      warnings.push(`May conflict with: ${conflicts.join(', ')}`);
      score -= 0.1;
    }

    // Determine status
    let status: 'compatible' | 'partial' | 'incompatible' | 'requires_update';
    if (score >= 0.8) status = 'compatible';
    else if (score >= 0.5) status = 'partial';
    else if (score >= 0.3) status = 'requires_update';
    else status = 'incompatible';

    return { score: Math.max(0, score), status, warnings, suggestions };
  }

  private calculateResonanceMatch(resonanceMap: ResonanceMap): number {
    let match = 0;
    let totalWeight = 0;

    // Compare field weights with user's field levels
    Object.entries(resonanceMap.fieldWeights).forEach(([field, weight]) => {
      const userLevel = this.profile.fieldLevels[field as ConsciousnessField] || 0;
      match += weight * userLevel;
      totalWeight += weight;
    });

    return totalWeight > 0 ? match / totalWeight : 0;
  }

  private generateFeedback(
    module: ExtractedModule,
    compatibility: ReturnType<typeof this.calculateCompatibility>,
    resonanceMatch: number
  ): string {
    const { manifest, resonanceMap } = module;
    const primaryField = resonanceMap.primaryField;

    if (compatibility.status === 'incompatible') {
      return `⚠️ Module "${manifest.name}" is not resonating with your current state. ${compatibility.warnings.join('. ')}. Your consciousness is calling for different work right now.`;
    }

    if (compatibility.status === 'requires_update') {
      return `🔄 Module "${manifest.name}" requires some preparation. ${compatibility.warnings.join('. ')}. ${compatibility.suggestions.join('. ')}.`;
    }

    if (compatibility.status === 'partial') {
      return `⚡ Module "${manifest.name}" is partially compatible (${(compatibility.score * 100).toFixed(0)}%). It aligns with your ${primaryField} field at ${(resonanceMatch * 100).toFixed(0)}% resonance. ${compatibility.warnings.length > 0 ? compatibility.warnings.join('. ') : 'You can use this, but full activation awaits higher coherence.'}.`;
    }

    // Compatible
    const gateInfo = manifest.gates && manifest.gates.length > 0
      ? ` This activates Gate${manifest.gates.length > 1 ? 's' : ''} ${manifest.gates.join(', ')}.`
      : '';

    return `✨ Module "${manifest.name}" is fully compatible (${(compatibility.score * 100).toFixed(0)}%)! Your ${primaryField} field resonates at ${(resonanceMatch * 100).toFixed(0)}%.${gateInfo} This program is ready to assemble and integrate into your consciousness architecture.`;
  }

  static getMockResonanceProfile(): UserResonanceProfile {
    return {
      userId: 'user_demo',
      coherence: 0.72,
      activeFields: ['heart', 'soul', 'mind'],
      fieldLevels: {
        zer: 0.3,
        mind: 0.7,
        body: 0.5,
        heart: 0.8,
        soul: 0.9,
        spirit: 0.4,
      },
      activeGates: [1, 12, 35, 42],
      preferences: {
        preferredTheme: 'cosmic',
      },
    };
  }
}

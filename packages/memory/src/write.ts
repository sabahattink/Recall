import { join } from 'node:path';
import type { ManifestFiles, RecallConfig, RepositorySnapshot } from '@recall-ai/schemas';
import { upsertGeneratedSection } from './markers.js';
import { readRecallConfig } from './config.js';
import { readFileIfExists, atomicWriteFile, backupIfExists, RECALL_DIR_NAME } from './safe-fs.js';
import { architectureTemplate, generateArchitectureBody } from './markdown/architecture.js';
import { conventionsTemplate, generateConventionsBody } from './markdown/conventions.js';
import { decisionsTemplate, generateDecisionsBody } from './markdown/decisions.js';
import { featuresTemplate, generateFeaturesBody } from './markdown/features.js';
import { glossaryTemplate, generateGlossaryBody } from './markdown/glossary.js';
import { risksTemplate, generateRisksBody } from './markdown/risks.js';
import { technicalDebtTemplate, generateTechnicalDebtBody } from './markdown/technical-debt.js';

export type MemoryFileKey = keyof ManifestFiles;

const GENERATORS: Record<
  MemoryFileKey,
  {
    body: (snapshot: RepositorySnapshot, config: RecallConfig) => string;
    template: () => (section: string) => string;
  }
> = {
  architecture: { body: (snapshot) => generateArchitectureBody(snapshot), template: architectureTemplate },
  conventions: { body: (snapshot) => generateConventionsBody(snapshot), template: conventionsTemplate },
  decisions: { body: (snapshot) => generateDecisionsBody(snapshot), template: decisionsTemplate },
  features: { body: (snapshot, config) => generateFeaturesBody(snapshot, config), template: featuresTemplate },
  glossary: { body: (snapshot, config) => generateGlossaryBody(snapshot, config), template: glossaryTemplate },
  risks: { body: (snapshot) => generateRisksBody(snapshot), template: risksTemplate },
  technicalDebt: { body: (snapshot) => generateTechnicalDebtBody(snapshot), template: technicalDebtTemplate },
};

export const MEMORY_FILE_NAMES: ManifestFiles = {
  architecture: 'architecture.md',
  conventions: 'conventions.md',
  decisions: 'decisions.md',
  features: 'features.md',
  glossary: 'glossary.md',
  risks: 'risks.md',
  technicalDebt: 'technical-debt.md',
};

export interface MemoryFileUpdate {
  key: MemoryFileKey;
  fileName: string;
  path: string;
  existingContent: string | null;
  nextContent: string;
  changed: boolean;
}

export async function computeMemoryFileUpdates(
  root: string,
  snapshot: RepositorySnapshot,
): Promise<MemoryFileUpdate[]> {
  const recallDir = join(root, RECALL_DIR_NAME);
  const config = await readRecallConfig(root);
  const updates: MemoryFileUpdate[] = [];
  for (const key of Object.keys(GENERATORS) as MemoryFileKey[]) {
    const fileName = MEMORY_FILE_NAMES[key];
    const path = join(recallDir, fileName);
    const existingContent = await readFileIfExists(path);
    const generator = GENERATORS[key];
    const { content, changed } = upsertGeneratedSection(
      existingContent,
      generator.body(snapshot, config),
      generator.template(),
    );
    updates.push({ key, fileName, path, existingContent, nextContent: content, changed });
  }
  return updates;
}

export async function applyMemoryFileUpdates(
  root: string,
  updates: MemoryFileUpdate[],
): Promise<void> {
  for (const update of updates) {
    if (!update.changed) continue;
    if (update.existingContent !== null) {
      await backupIfExists(root, update.path);
    }
    await atomicWriteFile(update.path, update.nextContent, { allowedRoot: root });
  }
}

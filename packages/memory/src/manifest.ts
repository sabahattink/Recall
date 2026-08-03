import { join } from 'node:path';
import {
  CURRENT_MANIFEST_SCHEMA_VERSION,
  ManifestSchema,
  manifestJsonSchema,
  type Manifest,
} from '@recall-ai/schemas';
import { atomicWriteFile, backupIfExists, readFileIfExists, RECALL_DIR_NAME } from './safe-fs.js';

export interface BuildManifestInput {
  toolVersion: string;
  repositoryName: string;
  repositoryRoot: string;
  defaultBranch: string | null;
  commit: string | null;
  branch: string | null;
  snapshotPath: string;
  /** Preserves the original `generatedAt` across `recall update` runs. */
  existing?: Manifest | null;
}

export function buildManifest(input: BuildManifestInput): Manifest {
  const now = new Date().toISOString();
  return {
    $schema: './schema/manifest.schema.json',
    schemaVersion: CURRENT_MANIFEST_SCHEMA_VERSION,
    toolVersion: input.toolVersion,
    repository: {
      name: input.repositoryName,
      root: input.repositoryRoot,
      defaultBranch: input.defaultBranch,
    },
    generatedAt: input.existing?.generatedAt ?? now,
    updatedAt: now,
    snapshot: {
      commit: input.commit,
      branch: input.branch,
      path: input.snapshotPath,
    },
    files: {
      architecture: 'architecture.md',
      conventions: 'conventions.md',
      decisions: 'decisions.md',
      features: 'features.md',
      glossary: 'glossary.md',
      risks: 'risks.md',
      technicalDebt: 'technical-debt.md',
    },
  };
}

export interface ManifestReadResult {
  manifest: Manifest | null;
  error: string | null;
}

export async function readManifest(root: string): Promise<ManifestReadResult> {
  const recallDir = join(root, RECALL_DIR_NAME);
  const raw = await readFileIfExists(join(recallDir, 'manifest.json'));
  if (raw === null) return { manifest: null, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { manifest: null, error: 'manifest.json is not valid JSON' };
  }
  const result = ManifestSchema.safeParse(parsed);
  if (!result.success) {
    return { manifest: null, error: result.error.issues.map((i) => i.message).join('; ') };
  }
  return { manifest: result.data, error: null };
}

export async function writeManifest(root: string, manifest: Manifest): Promise<void> {
  const recallDir = join(root, RECALL_DIR_NAME);
  const manifestPath = join(recallDir, 'manifest.json');
  await backupIfExists(root, manifestPath);
  await atomicWriteFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    allowedRoot: root,
  });
  await atomicWriteFile(
    join(recallDir, 'schema', 'manifest.schema.json'),
    `${JSON.stringify(manifestJsonSchema, null, 2)}\n`,
    { allowedRoot: root },
  );
}

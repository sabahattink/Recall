import { join } from 'node:path';
import {
  RepositorySnapshotSchema,
  snapshotJsonSchema,
  type RepositorySnapshot,
} from '@recall-ai/schemas';
import { atomicWriteFile, backupIfExists, readFileIfExists, RECALL_DIR_NAME } from './safe-fs.js';

export const SNAPSHOT_RELATIVE_PATH = 'snapshots/latest.json';

export async function writeSnapshot(root: string, snapshot: RepositorySnapshot): Promise<void> {
  const recallDir = join(root, RECALL_DIR_NAME);
  const snapshotPath = join(recallDir, SNAPSHOT_RELATIVE_PATH);
  await backupIfExists(root, snapshotPath);
  await atomicWriteFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
    allowedRoot: root,
  });
  await atomicWriteFile(
    join(recallDir, 'schema', 'snapshot.schema.json'),
    `${JSON.stringify(snapshotJsonSchema, null, 2)}\n`,
    { allowedRoot: root },
  );
}

export interface SnapshotReadResult {
  snapshot: RepositorySnapshot | null;
  error: string | null;
}

export async function readSnapshot(root: string): Promise<SnapshotReadResult> {
  const recallDir = join(root, RECALL_DIR_NAME);
  const raw = await readFileIfExists(join(recallDir, SNAPSHOT_RELATIVE_PATH));
  if (raw === null) return { snapshot: null, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { snapshot: null, error: 'snapshots/latest.json is not valid JSON' };
  }
  const result = RepositorySnapshotSchema.safeParse(parsed);
  if (!result.success) {
    return { snapshot: null, error: result.error.issues.map((i) => i.message).join('; ') };
  }
  return { snapshot: result.data, error: null };
}

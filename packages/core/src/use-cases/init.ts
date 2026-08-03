import {
  applyMemoryFileUpdates,
  buildManifest,
  computeMemoryFileUpdates,
  ensureRecallCacheIgnored,
  readManifest,
  writeManifest,
  writeSnapshot,
  type MemoryFileUpdate,
} from '@recall-ai/memory';
import type { RepositorySnapshot } from '@recall-ai/schemas';
import { recallDirFor, resolveRepositoryRoot } from '../paths.js';
import { runScan } from '../scan-runner.js';

export interface InitOptions {
  path: string;
  force?: boolean;
  dryRun?: boolean;
  toolVersion: string;
  maxFiles?: number;
}

export interface InitResult {
  root: string;
  recallDir: string;
  dryRun: boolean;
  wasAlreadyInitialized: boolean;
  snapshot: RepositorySnapshot;
  snapshotTruncated: boolean;
  memoryFileUpdates: MemoryFileUpdate[];
  gitignoreChanged: boolean;
}

export async function runInit(options: InitOptions): Promise<InitResult> {
  const root = await resolveRepositoryRoot(options.path);
  const recallDir = recallDirFor(root);

  const { manifest: existingManifest } = await readManifest(recallDir);
  const wasAlreadyInitialized = existingManifest !== null;

  // Ensure .gitignore is updated *before* scanning, so the persisted snapshot
  // reflects the repository's final on-disk state. Doing this after the scan
  // would make `recall status`/`recall update` immediately report the
  // repository as changed (the .gitignore edit itself would show up as an
  // untracked diff the snapshot never saw).
  const gitignoreResult = options.dryRun
    ? { changed: false, path: '' }
    : await ensureRecallCacheIgnored(root);

  const { snapshot, truncated } = await runScan(root, { maxFiles: options.maxFiles });

  const manifest = buildManifest({
    toolVersion: options.toolVersion,
    repositoryName: snapshot.repository.name,
    repositoryRoot: '.',
    defaultBranch: snapshot.git?.defaultBranch ?? null,
    commit: snapshot.git?.commit ?? null,
    branch: snapshot.git?.branch ?? null,
    snapshotPath: 'snapshots/latest.json',
    existing: options.force ? null : existingManifest,
  });

  const memoryFileUpdates = await computeMemoryFileUpdates(recallDir, snapshot);

  if (!options.dryRun) {
    await writeManifest(recallDir, manifest);
    await writeSnapshot(recallDir, snapshot);
    await applyMemoryFileUpdates(recallDir, memoryFileUpdates);
  }

  return {
    root,
    recallDir,
    dryRun: Boolean(options.dryRun),
    wasAlreadyInitialized,
    snapshot,
    snapshotTruncated: truncated,
    memoryFileUpdates,
    gitignoreChanged: gitignoreResult.changed,
  };
}

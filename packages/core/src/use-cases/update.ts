import {
  applyMemoryFileUpdates,
  buildManifest,
  computeMemoryFileUpdates,
  computeStaleness,
  diffSnapshots,
  readManifest,
  readSnapshot,
  writeManifest,
  writeSnapshot,
  type ChangeReport,
  type MemoryFileUpdate,
  type StalenessResult,
} from '@recall-ai/memory';
import { GitAdapter } from '@recall-ai/git';
import type { RepositorySnapshot } from '@recall-ai/schemas';
import { InvalidStateError } from '../errors.js';
import { assertRecallDirNotSymlink, resolveRepositoryRoot } from '../paths.js';
import { runScan } from '../scan-runner.js';

export interface UpdateOptions {
  path: string;
  since?: string;
  dryRun?: boolean;
  check?: boolean;
  toolVersion: string;
  maxFiles?: number;
}

export interface UpdateResult {
  root: string;
  previousSnapshot: RepositorySnapshot;
  currentSnapshot: RepositorySnapshot;
  changeReport: ChangeReport;
  staleness: StalenessResult;
  applied: boolean;
  memoryFileUpdates: MemoryFileUpdate[];
  sinceRefFiles: string[] | null;
}

export async function runUpdate(options: UpdateOptions): Promise<UpdateResult> {
  const root = await resolveRepositoryRoot(options.path);
  await assertRecallDirNotSymlink(root);

  const [{ manifest }, { snapshot: previousSnapshot, error: snapshotError }] = await Promise.all([
    readManifest(root),
    readSnapshot(root),
  ]);

  if (!manifest || !previousSnapshot) {
    throw new InvalidStateError(
      snapshotError
        ? `Recall memory is corrupted: ${snapshotError}. Run \`recall init --force\` to rebuild it.`
        : 'Recall is not initialized in this directory. Run `recall init` first.',
    );
  }

  const { snapshot: currentSnapshot } = await runScan(root, { maxFiles: options.maxFiles });

  let sinceRefFiles: string[] | null = null;
  if (options.since) {
    const git = new GitAdapter(root);
    const diff = await git.diffNameStatus(options.since, 'HEAD');
    sinceRefFiles = diff.map((entry) => entry.path);
  }

  const changeReport = diffSnapshots(previousSnapshot, currentSnapshot);
  const staleness = computeStaleness({
    snapshotExists: true,
    snapshotCommit: manifest.snapshot.commit,
    currentCommit: currentSnapshot.git?.commit ?? null,
    changeReport,
  });

  const memoryFileUpdates = await computeMemoryFileUpdates(root, currentSnapshot);

  let applied = false;
  if (!options.dryRun && !options.check) {
    const nextManifest = buildManifest({
      toolVersion: options.toolVersion,
      repositoryName: currentSnapshot.repository.name,
      repositoryRoot: '.',
      defaultBranch: currentSnapshot.git?.defaultBranch ?? null,
      commit: currentSnapshot.git?.commit ?? null,
      branch: currentSnapshot.git?.branch ?? null,
      snapshotPath: 'snapshots/latest.json',
      existing: manifest,
    });
    await writeManifest(root, nextManifest);
    await writeSnapshot(root, currentSnapshot);
    await applyMemoryFileUpdates(root, memoryFileUpdates);
    applied = true;
  }

  return {
    root,
    previousSnapshot,
    currentSnapshot,
    changeReport,
    staleness,
    applied,
    memoryFileUpdates,
    sinceRefFiles,
  };
}

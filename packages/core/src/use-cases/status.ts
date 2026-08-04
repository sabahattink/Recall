import { join } from 'node:path';
import {
  MEMORY_FILE_NAMES,
  readFileIfExists,
  readManifest,
  readSnapshot,
  validateMarkers,
  computeStaleness,
  diffSnapshots,
  type ChangeReport,
} from '@recall-ai/memory';
import type { Manifest } from '@recall-ai/schemas';
import { GitAdapter } from '@recall-ai/git';
import { recallDirExists, recallDirFor, resolveRepositoryRoot } from '../paths.js';
import { runScan } from '../scan-runner.js';

export type OverallStatus = 'ok' | 'stale' | 'not-initialized' | 'error';

export interface MalformedFile {
  path: string;
  reason: string;
}

export interface StatusResult {
  root: string;
  initialized: boolean;
  manifest: Manifest | null;
  lastSnapshotCommit: string | null;
  currentCommit: string | null;
  currentBranch: string | null;
  changedFilesSinceSnapshot: string[];
  stale: boolean;
  staleReasons: string[];
  missingMemoryFiles: string[];
  malformedFiles: MalformedFile[];
  detectedProjectType: string | null;
  overallStatus: OverallStatus;
}

export async function runStatus(inputPath: string): Promise<StatusResult> {
  const root = await resolveRepositoryRoot(inputPath);
  const initialized = await recallDirExists(root);

  if (!initialized) {
    return {
      root,
      initialized: false,
      manifest: null,
      lastSnapshotCommit: null,
      currentCommit: null,
      currentBranch: null,
      changedFilesSinceSnapshot: [],
      stale: false,
      staleReasons: [],
      missingMemoryFiles: Object.values(MEMORY_FILE_NAMES),
      malformedFiles: [],
      detectedProjectType: null,
      overallStatus: 'not-initialized',
    };
  }

  const recallDir = recallDirFor(root);
  const [{ manifest, error: manifestError }, { snapshot, error: snapshotError }] =
    await Promise.all([readManifest(root), readSnapshot(root)]);

  const malformedFiles: MalformedFile[] = [];
  if (manifestError) malformedFiles.push({ path: 'manifest.json', reason: manifestError });
  if (snapshotError) malformedFiles.push({ path: 'snapshots/latest.json', reason: snapshotError });

  const missingMemoryFiles: string[] = [];
  for (const fileName of Object.values(MEMORY_FILE_NAMES)) {
    const content = await readFileIfExists(join(recallDir, fileName));
    if (content === null) {
      missingMemoryFiles.push(fileName);
      continue;
    }
    const validation = validateMarkers(content);
    if (!validation.valid) {
      malformedFiles.push({
        path: fileName,
        reason: validation.reason ?? 'invalid generated markers',
      });
    }
  }

  const git = new GitAdapter(root);
  const currentCommit = await git.currentCommit();
  const currentBranch = await git.currentBranch();

  let changedFilesSinceSnapshot: string[] = [];
  let changeReport: ChangeReport | null = null;
  const snapshotCommit = manifest?.snapshot.commit ?? null;

  if (currentCommit !== null) {
    // Git-tracked repository: cheap path using `git diff`/working-tree status
    // instead of a full re-scan.
    if (snapshotCommit && snapshotCommit !== currentCommit) {
      try {
        const diff = await git.diffNameStatus(snapshotCommit, currentCommit);
        changedFilesSinceSnapshot = diff.map((d) => d.path);
      } catch {
        changedFilesSinceSnapshot = [];
      }
    }
    // Recall's own edits (.recall/** and the .gitignore line it manages) are
    // expected to be untracked or modified immediately after init/update;
    // they are not evidence that the *source* repository has drifted from
    // the snapshot (which was itself taken after those edits were made), so
    // they are excluded here.
    const uncommitted = (await git.changedFiles()).filter(
      (path) => !path.startsWith('.recall/') && path !== '.gitignore',
    );
    changedFilesSinceSnapshot = [...new Set([...changedFilesSinceSnapshot, ...uncommitted])].sort();
    if (changedFilesSinceSnapshot.length > 0) {
      changeReport = {
        filesAdded: [],
        filesRemoved: [],
        filesChanged: changedFilesSinceSnapshot,
        packagesAdded: [],
        packagesRemoved: [],
        dependencyChanges: [],
        scriptChanges: [],
        frameworkChanges: [],
        architectureRelevantChanges: [],
        possibleNewFeatures: [],
        possibleRemovedFeatures: [],
        risksIntroduced: [],
        risksResolved: [],
        hasChanges: true,
      };
    }
  } else if (snapshot) {
    // Non-Git repository: there is no commit history to diff against, so
    // freshness can't depend on a commit SHA at all. Re-scan and compare
    // deterministically against the persisted snapshot instead — the same
    // mechanism `recall update` already uses.
    const { snapshot: rescanned } = await runScan(root, {});
    changeReport = diffSnapshots(snapshot, rescanned);
    changedFilesSinceSnapshot = [
      ...changeReport.filesAdded,
      ...changeReport.filesRemoved,
      ...changeReport.filesChanged,
    ].sort();
  }

  const staleness = computeStaleness({
    snapshotExists: snapshot !== null,
    snapshotCommit,
    currentCommit,
    changeReport,
  });

  const detectedProjectType = snapshot
    ? [...new Set(snapshot.frameworks.map((f) => f.name))].join(', ') || 'generic-node'
    : null;

  const hasErrors = malformedFiles.length > 0 || missingMemoryFiles.length > 0;
  const overallStatus: OverallStatus = hasErrors ? 'error' : staleness.stale ? 'stale' : 'ok';

  return {
    root,
    initialized: true,
    manifest,
    lastSnapshotCommit: snapshotCommit,
    currentCommit,
    currentBranch,
    changedFilesSinceSnapshot,
    stale: staleness.stale,
    staleReasons: staleness.reasons,
    missingMemoryFiles,
    malformedFiles,
    detectedProjectType,
    overallStatus,
  };
}

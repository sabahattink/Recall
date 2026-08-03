import { scanRepository, type ScanOptions as AnalyzerScanOptions } from '@recall-ai/analyzers';
import { GitAdapter } from '@recall-ai/git';
import type { RepositorySnapshot } from '@recall-ai/schemas';

export interface RunScanOptions {
  maxFiles?: number;
  maxFileSizeBytes?: number;
  signal?: AbortSignal;
}

export interface RunScanResult {
  snapshot: RepositorySnapshot;
  truncated: boolean;
}

/**
 * Runs a full deterministic scan: collects Git metadata (if the directory is
 * a repository) and the list of Git-tracked files (used only for the
 * generated-file-tracking risk rule), then delegates to the analyzers
 * package for the rest of the snapshot.
 */
export async function runScan(root: string, options: RunScanOptions = {}): Promise<RunScanResult> {
  const git = new GitAdapter(root);
  const [gitMetadata, gitTrackedFiles] = await Promise.all([
    git.collectMetadata(),
    git.listTrackedFiles(),
  ]);

  const analyzerOptions: AnalyzerScanOptions = {
    maxFiles: options.maxFiles,
    maxFileSizeBytes: options.maxFileSizeBytes,
    gitMetadata,
    gitTrackedFiles: gitTrackedFiles.length > 0 ? gitTrackedFiles : null,
    signal: options.signal,
  };

  return scanRepository(root, analyzerOptions);
}

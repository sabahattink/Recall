import { resolve } from 'node:path';
import { atomicWriteFile } from '@recall-ai/memory';
import type { RepositorySnapshot } from '@recall-ai/schemas';
import { resolveRepositoryRoot } from '../paths.js';
import { runScan } from '../scan-runner.js';

export interface ScanOptions {
  path: string;
  maxFiles?: number;
  output?: string;
}

export interface ScanResult {
  root: string;
  snapshot: RepositorySnapshot;
  truncated: boolean;
  outputPath: string | null;
}

export async function runScanCommand(options: ScanOptions): Promise<ScanResult> {
  const root = await resolveRepositoryRoot(options.path);
  const { snapshot, truncated } = await runScan(root, { maxFiles: options.maxFiles });

  let outputPath: string | null = null;
  if (options.output) {
    // `--output` is an explicit, user-supplied destination and is
    // intentionally exempt from repository-root containment (see
    // `atomicWriteFile`'s `allowedRoot` option); it still refuses to write
    // through an existing symlink at the destination itself.
    outputPath = resolve(options.output);
    await atomicWriteFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  return { root, snapshot, truncated, outputPath };
}

import { ExitCode, runInit } from '@recall-ai/core';
import type { GlobalOptions } from '../global-options.js';
import type { Reporter } from '../reporter.js';
import { CLI_VERSION } from '../package-info.js';

export interface InitCommandOptions {
  force?: boolean;
  dryRun?: boolean;
}

export async function initCommand(
  reporter: Reporter,
  global: GlobalOptions,
  options: InitCommandOptions,
): Promise<number> {
  reporter.progress('Analyzing repository...');
  const result = await runInit({
    path: global.path,
    force: options.force,
    dryRun: options.dryRun,
    toolVersion: CLI_VERSION,
  });

  const changed = result.memoryFileUpdates.filter((u) => u.changed);
  const unchanged = result.memoryFileUpdates.filter((u) => !u.changed);

  if (global.json) {
    reporter.json({
      root: result.root,
      recallDir: result.recallDir,
      dryRun: result.dryRun,
      wasAlreadyInitialized: result.wasAlreadyInitialized,
      truncated: result.snapshotTruncated,
      filesWritten: changed.map((u) => u.fileName),
      filesUnchanged: unchanged.map((u) => u.fileName),
      gitignoreChanged: result.gitignoreChanged,
    });
  } else {
    const verb = result.dryRun
      ? 'Would initialize'
      : result.wasAlreadyInitialized
        ? 'Refreshed'
        : 'Initialized';
    reporter.stdout(`${reporter.colors.green(verb)} Recall memory at ${result.recallDir}`);
    if (changed.length > 0) {
      reporter.stdout(
        `  ${result.dryRun ? 'Would write' : 'Wrote'}: ${changed.map((u) => u.fileName).join(', ')}`,
      );
    }
    if (unchanged.length > 0) {
      reporter.info(`  Unchanged: ${unchanged.map((u) => u.fileName).join(', ')}`);
    }
    if (result.gitignoreChanged) {
      reporter.info('  Added .recall/cache/ to .gitignore');
    }
    if (result.snapshotTruncated) {
      reporter.warn('The file scan hit --max-files and was truncated; results may be incomplete.');
    }
  }

  return result.snapshotTruncated ? ExitCode.AnalysisIncomplete : ExitCode.Success;
}

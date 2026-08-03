import { ExitCode, runStatus } from '@recall-ai/core';
import type { GlobalOptions } from '../global-options.js';
import type { Reporter } from '../reporter.js';

export async function statusCommand(reporter: Reporter, global: GlobalOptions): Promise<number> {
  const status = await runStatus(global.path);

  if (global.json) {
    reporter.json(status);
  } else if (!status.initialized) {
    reporter.stdout('Recall is not initialized in this directory.');
    reporter.stdout('Run `recall init` to get started.');
  } else {
    const statusLabel =
      status.overallStatus === 'ok'
        ? reporter.colors.green('ok')
        : status.overallStatus === 'stale'
          ? reporter.colors.yellow('stale')
          : reporter.colors.red('error');

    reporter.stdout(`Status: ${statusLabel}`);
    reporter.stdout(`Project type: ${status.detectedProjectType ?? 'unknown'}`);
    reporter.stdout(`Last snapshot commit: ${status.lastSnapshotCommit ?? '(none)'}`);
    reporter.stdout(`Current commit: ${status.currentCommit ?? '(not a git repository)'}`);
    reporter.stdout(`Current branch: ${status.currentBranch ?? '(none)'}`);
    if (status.changedFilesSinceSnapshot.length > 0) {
      reporter.stdout(`Changed files since snapshot: ${status.changedFilesSinceSnapshot.length}`);
    }
    if (status.stale) {
      reporter.warn(`Memory is stale: ${status.staleReasons.join('; ')}`);
    }
    if (status.missingMemoryFiles.length > 0) {
      reporter.warn(`Missing memory files: ${status.missingMemoryFiles.join(', ')}`);
    }
    if (status.malformedFiles.length > 0) {
      for (const malformed of status.malformedFiles) {
        reporter.warn(`Malformed file ${malformed.path}: ${malformed.reason}`);
      }
    }
  }

  if (status.overallStatus === 'not-initialized' || status.overallStatus === 'error') {
    return ExitCode.InvalidState;
  }
  if (status.overallStatus === 'stale') {
    return ExitCode.StaleMemory;
  }
  return ExitCode.Success;
}

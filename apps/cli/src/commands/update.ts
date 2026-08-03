import { ExitCode, runUpdate } from '@recall-ai/core';
import type { GlobalOptions } from '../global-options.js';
import type { Reporter } from '../reporter.js';
import { CLI_VERSION } from '../package-info.js';

export interface UpdateCommandOptions {
  since?: string;
  dryRun?: boolean;
  check?: boolean;
}

export async function updateCommand(
  reporter: Reporter,
  global: GlobalOptions,
  options: UpdateCommandOptions,
): Promise<number> {
  reporter.progress('Comparing repository against the last snapshot...');
  const result = await runUpdate({
    path: global.path,
    since: options.since,
    dryRun: options.dryRun,
    check: options.check,
    toolVersion: CLI_VERSION,
  });

  if (global.json) {
    reporter.json({
      hasChanges: result.changeReport.hasChanges,
      stale: result.staleness.stale,
      staleReasons: result.staleness.reasons,
      applied: result.applied,
      changeReport: result.changeReport,
    });
  } else {
    const report = result.changeReport;
    if (!report.hasChanges) {
      reporter.stdout('No changes detected since the last snapshot.');
    } else {
      reporter.stdout('Changes since the last snapshot:');
      printList(reporter, 'Files added', report.filesAdded);
      printList(reporter, 'Files removed', report.filesRemoved);
      printList(reporter, 'Files changed', report.filesChanged);
      printList(reporter, 'Packages added', report.packagesAdded);
      printList(reporter, 'Packages removed', report.packagesRemoved);
      printList(
        reporter,
        'Dependency changes',
        report.dependencyChanges.map(
          (d) => `${d.name}: ${d.from ?? '(none)'} -> ${d.to ?? '(removed)'}`,
        ),
      );
      printList(
        reporter,
        'Framework changes',
        report.frameworkChanges.map((f) => `${f.name} ${f.change}`),
      );
      printList(reporter, 'Architecture-relevant changes', report.architectureRelevantChanges);
      printList(
        reporter,
        'Possible new features',
        report.possibleNewFeatures.map((f) => `${f.category}: ${f.name}`),
      );
      printList(
        reporter,
        'Possible removed features',
        report.possibleRemovedFeatures.map((f) => `${f.category}: ${f.name}`),
      );
      printList(
        reporter,
        'Risks introduced',
        report.risksIntroduced.map((r) => `[${r.severity}] ${r.description}`),
      );
      printList(
        reporter,
        'Risks resolved',
        report.risksResolved.map((r) => r.description),
      );
    }

    if (result.staleness.stale) {
      reporter.warn(`Memory is stale: ${result.staleness.reasons.join('; ')}`);
    }
    if (options.dryRun) {
      reporter.info('(dry run: no files were written)');
    } else if (options.check) {
      reporter.info('(--check: no files were written)');
    } else if (result.applied) {
      reporter.stdout(reporter.colors.green('Memory files updated.'));
    }
  }

  if (options.check && result.staleness.stale) {
    return ExitCode.StaleMemory;
  }
  return ExitCode.Success;
}

function printList(reporter: Reporter, label: string, items: string[]): void {
  if (items.length === 0) return;
  reporter.stdout(`  ${label} (${items.length}):`);
  for (const item of items.slice(0, 20)) {
    reporter.stdout(`    - ${item}`);
  }
  if (items.length > 20) {
    reporter.stdout(`    ... and ${items.length - 20} more`);
  }
}

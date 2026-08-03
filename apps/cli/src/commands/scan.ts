import { ExitCode, runScanCommand } from '@recall-ai/core';
import type { GlobalOptions } from '../global-options.js';
import type { Reporter } from '../reporter.js';

export interface ScanCommandOptions {
  maxFiles?: number;
  output?: string;
}

export async function scanCommand(
  reporter: Reporter,
  global: GlobalOptions,
  options: ScanCommandOptions,
): Promise<number> {
  reporter.progress('Scanning repository...');
  const result = await runScanCommand({
    path: global.path,
    maxFiles: options.maxFiles,
    output: options.output,
  });

  if (global.json) {
    reporter.json(result.snapshot);
  } else {
    const frameworks = [...new Set(result.snapshot.frameworks.map((f) => f.name))];
    reporter.stdout(`Scanned ${result.root}`);
    reporter.stdout(`  Package manager: ${result.snapshot.ecosystem.packageManager}`);
    reporter.stdout(`  Frameworks: ${frameworks.join(', ') || 'none detected'}`);
    reporter.stdout(`  Workspaces: ${result.snapshot.workspaces.length}`);
    reporter.stdout(
      `  Files scanned: ${result.snapshot.files.length}${result.truncated ? ' (truncated)' : ''}`,
    );
    reporter.stdout(`  Risks found: ${result.snapshot.risks.length}`);
    if (result.outputPath) reporter.stdout(`  Snapshot written to ${result.outputPath}`);
    if (result.truncated) reporter.warn('File scan hit --max-files and was truncated.');
  }

  return result.truncated ? ExitCode.AnalysisIncomplete : ExitCode.Success;
}

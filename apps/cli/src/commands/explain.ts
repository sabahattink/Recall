import { ExitCode, runExplain } from '@recall-ai/core';
import type { GlobalOptions } from '../global-options.js';
import type { Reporter } from '../reporter.js';

export async function explainCommand(
  reporter: Reporter,
  global: GlobalOptions,
  targetPath: string,
): Promise<number> {
  const result = await runExplain(global.path, targetPath);

  if (global.json) {
    reporter.json(result);
    return ExitCode.Success;
  }

  reporter.stdout(`Path: ${result.path} (${result.type})`);
  reporter.stdout(`Likely responsibility: ${result.likelyResponsibility}`);
  reporter.stdout(`Confidence: ${result.confidence}`);
  reporter.stdout(
    `Package/application ownership: ${result.owningWorkspace ?? '(unowned / repository root)'}`,
  );

  if (result.incomingDependencies.length > 0) {
    reporter.stdout(`Incoming internal dependencies (${result.incomingDependencies.length}):`);
    for (const edge of result.incomingDependencies.slice(0, 10)) {
      reporter.stdout(`  - ${edge.from} -> ${edge.to}`);
    }
  }
  if (result.outgoingDependencies.length > 0) {
    reporter.stdout(`Outgoing internal dependencies (${result.outgoingDependencies.length}):`);
    for (const edge of result.outgoingDependencies.slice(0, 10)) {
      reporter.stdout(`  - ${edge.from} -> ${edge.to}`);
    }
  }
  if (result.relatedTests.length > 0) {
    reporter.stdout(`Related tests: ${result.relatedTests.join(', ')}`);
  }
  if (result.relevantConfiguration.length > 0) {
    reporter.stdout(`Relevant configuration: ${result.relevantConfiguration.join(', ')}`);
  }
  if (result.relevantScripts.length > 0) {
    reporter.stdout(
      `Relevant scripts: ${result.relevantScripts.map((s) => `${s.name} (${s.command})`).join(', ')}`,
    );
  }
  reporter.stdout('Evidence:');
  for (const e of result.evidence) {
    reporter.stdout(`  - ${e.path}${e.line ? `:${e.line}` : ''} — ${e.reason}`);
  }
  if (result.unknowns.length > 0) {
    reporter.stdout('Unknowns:');
    for (const unknown of result.unknowns) {
      reporter.stdout(`  - ${unknown}`);
    }
  }

  return ExitCode.Success;
}

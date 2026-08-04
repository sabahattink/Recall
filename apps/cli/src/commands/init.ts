import { ExitCode, runInit } from '@recall-ai/core';
import type { FrameworkDetection, RepositorySnapshot } from '@recall-ai/schemas';
import type { GlobalOptions } from '../global-options.js';
import type { Reporter } from '../reporter.js';
import { CLI_VERSION } from '../package-info.js';

export interface InitCommandOptions {
  force?: boolean;
  dryRun?: boolean;
}

const FRAMEWORK_LABELS: Record<FrameworkDetection['name'], string> = {
  nestjs: 'NestJS',
  nextjs: 'Next.js',
  react: 'React',
  express: 'Express',
  fastify: 'Fastify',
  vue: 'Vue',
  'generic-node': 'Generic Node.js',
};

const CONFIDENCE_RANK: Record<FrameworkDetection['confidence'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** The highest-confidence detected framework, or a generic fallback if none matched. */
function primaryFrameworkLabel(frameworks: RepositorySnapshot['frameworks']): string {
  if (frameworks.length === 0) return 'Generic Node.js';
  const best = [...frameworks].sort(
    (a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence],
  )[0] as FrameworkDetection;
  return FRAMEWORK_LABELS[best.name];
}

function formatElapsed(elapsedMs: number): string {
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

/** Concise "what just happened" summary shown after a real (non-dry-run, non-JSON) init. */
function formatSummary(
  reporter: Reporter,
  verb: 'Initialized' | 'Refreshed',
  elapsedMs: number,
  snapshot: RepositorySnapshot,
  generatedPaths: string[],
): string {
  const lines: string[] = [];

  lines.push(
    `${reporter.colors.green(`Recall ${verb.toLowerCase()}`)} in ${formatElapsed(elapsedMs)}`,
  );
  lines.push('');
  lines.push('Detected:');
  lines.push(`  Framework: ${primaryFrameworkLabel(snapshot.frameworks)}`);
  lines.push(`  Package manager: ${snapshot.ecosystem.packageManager}`);
  lines.push(`  Workspaces: ${snapshot.workspaces.length}`);
  lines.push(`  Entry points: ${snapshot.entryPoints.length}`);

  if (generatedPaths.length > 0) {
    const shown = generatedPaths.slice(0, 3);
    const remaining = generatedPaths.length - shown.length;
    lines.push('');
    lines.push('Generated:');
    for (const path of shown) lines.push(`  ${path}`);
    if (remaining > 0) lines.push(`  + ${remaining} more file${remaining === 1 ? '' : 's'}`);
  }

  lines.push('');
  lines.push('Next:');
  lines.push('  recall context --stdout');
  lines.push('  recall context --task "Describe your task"');

  return lines.join('\n');
}

export async function initCommand(
  reporter: Reporter,
  global: GlobalOptions,
  options: InitCommandOptions,
): Promise<number> {
  reporter.progress('Analyzing repository...');
  const startedAt = Date.now();
  const result = await runInit({
    path: global.path,
    force: options.force,
    dryRun: options.dryRun,
    toolVersion: CLI_VERSION,
  });
  const elapsedMs = Date.now() - startedAt;

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
  } else if (result.dryRun) {
    const verb = 'Would initialize';
    reporter.stdout(`${reporter.colors.green(verb)} Recall memory at ${result.recallDir}`);
    if (changed.length > 0) {
      reporter.stdout(`  Would write: ${changed.map((u) => u.fileName).join(', ')}`);
    }
    if (unchanged.length > 0) {
      reporter.info(`  Unchanged: ${unchanged.map((u) => u.fileName).join(', ')}`);
    }
  } else {
    const verb = result.wasAlreadyInitialized ? 'Refreshed' : 'Initialized';
    const generatedPaths = changed.map((u) => `.recall/${u.fileName}`);
    reporter.stdout(formatSummary(reporter, verb, elapsedMs, result.snapshot, generatedPaths));
    if (result.gitignoreChanged) {
      reporter.info('Added .recall/cache/ to .gitignore');
    }
  }

  if (result.snapshotTruncated) {
    reporter.warn('The file scan hit --max-files and was truncated; results may be incomplete.');
  }

  return result.snapshotTruncated ? ExitCode.AnalysisIncomplete : ExitCode.Success;
}

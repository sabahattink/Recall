import { cac } from 'cac';
import { InvalidUsageError } from '@recall-ai/core';
import { CLI_NAME, CLI_VERSION } from './package-info.js';
import { resolveGlobalOptions, type RawCacOptions } from './global-options.js';
import { Reporter } from './reporter.js';
import { withErrorHandling } from './error-handling.js';
import { initCommand } from './commands/init.js';
import { scanCommand } from './commands/scan.js';
import { updateCommand } from './commands/update.js';
import { statusCommand } from './commands/status.js';
import { explainCommand } from './commands/explain.js';
import { contextCommand } from './commands/context.js';
import { doctorCommand } from './commands/doctor.js';

interface CommandOptions extends RawCacOptions {
  force?: boolean;
  dryRun?: boolean;
  maxFiles?: string | number;
  output?: string;
  since?: string;
  check?: boolean;
  task?: string;
  maxTokens?: string | number;
  format?: string;
  stdout?: boolean;
}

function parseOptionalInt(value: string | number | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidUsageError(`${flag} must be a positive integer, got "${value}"`);
  }
  return parsed;
}

export function createCli() {
  const cli = cac(CLI_NAME);

  cli
    .option('--path <path>', 'Repository path to operate on', { default: '.' })
    .option('--json', 'Emit machine-readable JSON on stdout')
    .option('--quiet', 'Suppress non-essential output')
    .option('--verbose', 'Print stack traces on failure')
    .option('--no-color', 'Disable colored output');

  cli
    .command('init', 'Create or refresh the .recall memory directory for this repository')
    .option('--force', 'Reset generatedAt and force a full refresh even if already initialized')
    .option('--dry-run', 'Show what would be written without writing anything')
    .action(async (options: CommandOptions) => {
      const global = resolveGlobalOptions(options);
      const reporter = new Reporter(global);
      process.exitCode = await withErrorHandling(reporter, global.verbose, () =>
        initCommand(reporter, global, { force: options.force, dryRun: options.dryRun }),
      );
    });

  cli
    .command('scan', 'Run a deterministic repository scan and save a snapshot')
    .option('--max-files <n>', 'Maximum number of files to scan')
    .option(
      '--output <path>',
      'Write the snapshot JSON to an explicit path instead of stdout summary',
    )
    .action(async (options: CommandOptions) => {
      const global = resolveGlobalOptions(options);
      const reporter = new Reporter(global);
      process.exitCode = await withErrorHandling(reporter, global.verbose, () =>
        scanCommand(reporter, global, {
          maxFiles: parseOptionalInt(options.maxFiles, '--max-files'),
          output: options.output,
        }),
      );
    });

  cli
    .command('update', 'Compare the repository against the last snapshot and refresh memory')
    .option('--since <ref>', 'Restrict the file change list to a Git ref range (e.g. HEAD~5)')
    .option('--dry-run', 'Show what would change without writing anything')
    .option('--check', 'Exit non-zero if memory is stale, without writing anything (CI-friendly)')
    .action(async (options: CommandOptions) => {
      const global = resolveGlobalOptions(options);
      const reporter = new Reporter(global);
      process.exitCode = await withErrorHandling(reporter, global.verbose, () =>
        updateCommand(reporter, global, {
          since: options.since,
          dryRun: options.dryRun,
          check: options.check,
        }),
      );
    });

  cli
    .command('status', 'Show whether Recall is initialized and whether memory is stale')
    .action(async (options: CommandOptions) => {
      const global = resolveGlobalOptions(options);
      const reporter = new Reporter(global);
      process.exitCode = await withErrorHandling(reporter, global.verbose, () =>
        statusCommand(reporter, global),
      );
    });

  cli
    .command(
      'explain <path>',
      'Explain the role of a file or directory using deterministic evidence',
    )
    .action(async (path: string, options: CommandOptions) => {
      const global = resolveGlobalOptions(options);
      const reporter = new Reporter(global);
      process.exitCode = await withErrorHandling(reporter, global.verbose, () =>
        explainCommand(reporter, global, path),
      );
    });

  cli
    .command('context', 'Generate compact, agent-ready context from the last snapshot')
    .option('--task <task>', 'Focus the context on a specific task description')
    .option('--max-tokens <n>', 'Approximate maximum size of the generated context')
    .option('--format <format>', 'Output format (only "markdown" is supported)', {
      default: 'markdown',
    })
    .option('--stdout', 'Print context to stdout instead of writing .recall/context.md')
    .action(async (options: CommandOptions) => {
      const global = resolveGlobalOptions(options);
      const reporter = new Reporter(global);
      process.exitCode = await withErrorHandling(reporter, global.verbose, () =>
        contextCommand(reporter, global, {
          task: options.task,
          maxTokens: parseOptionalInt(options.maxTokens, '--max-tokens'),
          format: options.format,
          stdout: options.stdout,
        }),
      );
    });

  cli
    .command('doctor', "Validate Recall's environment and memory state")
    .action(async (options: CommandOptions) => {
      const global = resolveGlobalOptions(options);
      const reporter = new Reporter(global);
      process.exitCode = await withErrorHandling(reporter, global.verbose, () =>
        doctorCommand(reporter, global),
      );
    });

  cli.help();
  cli.version(CLI_VERSION);

  return cli;
}

export async function runCli(argv: string[]): Promise<void> {
  const cli = createCli();
  try {
    cli.parse(argv, { run: false });
    await cli.runMatchedCommand();
  } catch (error) {
    const reporter = new Reporter(resolveGlobalOptions({}));
    if (error instanceof InvalidUsageError) {
      reporter.error(error.message);
      process.exitCode = error.exitCode;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    reporter.error(`Unexpected failure: ${message}`);
    process.exitCode = 1;
  }
}

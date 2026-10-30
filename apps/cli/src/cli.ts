import {
  ExitCode,
  RecallError,
  runInit,
  type ExitCodeValue,
  type InitStage,
} from '@recall-ai/core';
import { parseArguments } from './arguments.js';
import { CLI_NAME, CLI_VERSION } from './package-info.js';

/** Where the CLI writes. Injected so tests can capture output without a subprocess. */
export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
  /** When true, unexpected failures also print their stack trace (RECALL_DEBUG=1). */
  debug: boolean;
}

/** The exact progress lines of docs/product-specification.md §11, one per stage. */
export const STAGE_MESSAGES: Record<InitStage, string> = {
  scan: 'Scanning repository...',
  memory: 'Detecting architecture...',
  generate: 'Generating AI memory...',
};
export const DONE_MESSAGE = 'Done.';

export const HELP_TEXT = [
  `${CLI_NAME} — initialize a repository's memory for AI coding assistants`,
  '',
  'Usage:',
  `  ${CLI_NAME} init [path] [--force]`,
  '',
  'Arguments:',
  '  path           Repository to initialize (default: the current directory)',
  '',
  'Options:',
  '  --force        Regenerate .recall/ when it already exists',
  '  -h, --help     Show this help',
  '  -v, --version  Show the version',
  '',
  'Writes .recall/memory.json and .recall/agents/{claude,codex,cursor,gemini,openai}.md.',
].join('\n');

/** Prints a failure to stderr and returns its exit code. */
export function reportFailure(io: CliIo, error: unknown): ExitCodeValue {
  if (error instanceof RecallError) {
    io.stderr(`error: ${error.message}`);
    return error.exitCode;
  }
  const message = error instanceof Error ? error.message : String(error);
  io.stderr(`error: Unexpected failure: ${message}`);
  if (io.debug && error instanceof Error && error.stack) io.stderr(error.stack);
  else io.stderr('Set RECALL_DEBUG=1 to include a stack trace.');
  return ExitCode.UnexpectedFailure;
}

/**
 * Runs `recall` with the given arguments (without the `node` and script
 * entries of `process.argv`) and returns the process exit code. On success,
 * stdout carries exactly the four progress lines of spec §11 and nothing
 * else; every diagnostic goes to stderr. Stack traces are printed only when
 * `io.debug` is set (CLI-06).
 */
export async function runCli(argv: readonly string[], io: CliIo): Promise<ExitCodeValue> {
  try {
    const parsed = parseArguments(argv);
    if (parsed.kind === 'help') {
      io.stdout(HELP_TEXT);
      return ExitCode.Success;
    }
    if (parsed.kind === 'version') {
      io.stdout(`${CLI_NAME}/${CLI_VERSION}`);
      return ExitCode.Success;
    }

    await runInit({
      path: parsed.path,
      force: parsed.force,
      onStage: (stage) => io.stdout(STAGE_MESSAGES[stage]),
    });
    io.stdout(DONE_MESSAGE);
    return ExitCode.Success;
  } catch (error) {
    return reportFailure(io, error);
  }
}

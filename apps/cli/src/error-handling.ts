import { ExitCode, RecallError } from '@recall-ai/core';
import type { Reporter } from './reporter.js';

/**
 * Runs a command action, mapping thrown errors to the documented exit codes.
 * `RecallError` subclasses carry their own exit code (invalid usage, invalid
 * state, stale memory, analysis incomplete); anything else is treated as an
 * unexpected failure. Stack traces are only ever printed with `--verbose`.
 */
export async function withErrorHandling(
  reporter: Reporter,
  verbose: boolean,
  action: () => Promise<number>,
): Promise<number> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof RecallError) {
      reporter.error(error.message);
      if (verbose && error.stack) reporter.error(error.stack);
      return error.exitCode;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      reporter.error('Cancelled.');
      return ExitCode.UnexpectedFailure;
    }
    const message = error instanceof Error ? error.message : String(error);
    reporter.error(`Unexpected failure: ${message}`);
    if (verbose && error instanceof Error && error.stack) {
      reporter.error(error.stack);
    }
    return ExitCode.UnexpectedFailure;
  }
}

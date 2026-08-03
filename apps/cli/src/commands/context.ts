import { ExitCode, InvalidUsageError, runContext } from '@recall-ai/core';
import type { GlobalOptions } from '../global-options.js';
import type { Reporter } from '../reporter.js';

export interface ContextCommandOptions {
  task?: string;
  maxTokens?: number;
  format?: string;
  stdout?: boolean;
}

export async function contextCommand(
  reporter: Reporter,
  global: GlobalOptions,
  options: ContextCommandOptions,
): Promise<number> {
  if (options.format && options.format !== 'markdown') {
    throw new InvalidUsageError(
      `Unsupported --format "${options.format}". Only "markdown" is supported.`,
    );
  }

  const result = await runContext({
    path: global.path,
    task: options.task,
    maxTokens: options.maxTokens,
    stdout: options.stdout,
  });

  if (global.json) {
    reporter.json({
      estimatedTokens: result.estimatedTokens,
      truncated: result.truncated,
      outputPath: result.outputPath,
      content: result.content,
    });
    return ExitCode.Success;
  }

  if (options.stdout) {
    reporter.stdout(result.content);
    return ExitCode.Success;
  }

  reporter.stdout(
    `Context written to ${result.outputPath} (~${result.estimatedTokens} estimated tokens)`,
  );
  if (result.truncated) {
    reporter.warn('Context was truncated to fit --max-tokens.');
  }
  return ExitCode.Success;
}

import { InvalidUsageError } from '@recall-ai/core';

export type ParsedArguments =
  { kind: 'help' } | { kind: 'version' } | { kind: 'init'; path: string; force: boolean };

const HELP_FLAGS = new Set(['-h', '--help']);
const VERSION_FLAGS = new Set(['-v', '--version']);
const DEFAULT_PATH = '.';

/**
 * Parses `recall`'s complete public surface (docs/product-specification.md
 * §18): `recall init [path] [--force]`, plus the conventional `--help` and
 * `--version`. Anything else — another command, another flag, a flag value,
 * a second path — is rejected with `InvalidUsageError` rather than ignored,
 * so no undocumented behavior can exist. A `--` ends option parsing, for a
 * path that itself starts with `-`.
 */
export function parseArguments(argv: readonly string[]): ParsedArguments {
  const endOfOptions = argv.indexOf('--');
  const options = endOfOptions === -1 ? argv : argv.slice(0, endOfOptions);
  if (options.some((arg) => HELP_FLAGS.has(arg))) return { kind: 'help' };
  if (options.some((arg) => VERSION_FLAGS.has(arg))) return { kind: 'version' };

  const [command, ...rest] = argv;
  if (command === undefined)
    throw new InvalidUsageError('Missing command. Usage: recall init [path] [--force]');
  if (command !== 'init') {
    throw new InvalidUsageError(`Unknown command "${command}". The only command is "init".`);
  }

  let force = false;
  const positionals: string[] = [];
  let optionsEnded = false;
  for (const arg of rest) {
    if (!optionsEnded && arg === '--') {
      optionsEnded = true;
    } else if (!optionsEnded && arg === '--force') {
      force = true;
    } else if (!optionsEnded && arg.startsWith('-') && arg !== '-') {
      throw new InvalidUsageError(`Unknown option "${arg}". The only option is "--force".`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length > 1) {
    throw new InvalidUsageError(
      `Expected at most one path, got ${positionals.length}: ${positionals.join(' ')}`,
    );
  }

  return { kind: 'init', path: positionals[0] ?? DEFAULT_PATH, force };
}

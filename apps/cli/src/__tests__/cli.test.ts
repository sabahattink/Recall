import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSimpleNodeFixture,
  createDirLink,
  createTempDir,
  integrationTestTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { InvalidPathError } from '@recall-ai/core';
import { HELP_TEXT, reportFailure, runCli } from '../cli.js';
import { parseArguments } from '../arguments.js';

interface Captured {
  exitCode: number;
  stdout: string[];
  stderr: string[];
}

async function run(...argv: string[]): Promise<Captured> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runCli(argv, {
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
    debug: false,
  });
  return { exitCode, stdout, stderr };
}

describe('parseArguments', () => {
  it.each([
    [['init'], { kind: 'init', path: '.', force: false }],
    [['init', 'repo'], { kind: 'init', path: 'repo', force: false }],
    [['init', '--force'], { kind: 'init', path: '.', force: true }],
    [['init', '--force', 'repo'], { kind: 'init', path: 'repo', force: true }],
    [['init', '--', '-odd-dir'], { kind: 'init', path: '-odd-dir', force: false }],
    [['--help'], { kind: 'help' }],
    [['init', '-h'], { kind: 'help' }],
    [['--version'], { kind: 'version' }],
    [['-v'], { kind: 'version' }],
  ])('parses %j', (argv, expected) => {
    expect(parseArguments(argv)).toEqual(expected);
  });

  it.each([
    [[], /Missing command/],
    [['status'], /Unknown command "status"/],
    [['context', '--stdout'], /Unknown command "context"/],
    [['init', '--dry-run'], /Unknown option "--dry-run"/],
    [['init', '--force=yes'], /Unknown option "--force=yes"/],
    [['init', '--path', 'x'], /Unknown option "--path"/],
    [['init', 'a', 'b'], /at most one path/],
  ])('rejects %j', (argv, message) => {
    expect(() => parseArguments(argv)).toThrow(message);
  });
});

describe('recall (in-process)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildSimpleNodeFixture(dir);
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it(
    'prints exactly the four lines of spec §11 on success, and nothing on stderr (CLI-04)',
    async () => {
      const result = await run('init', dir);
      expect(result).toEqual({
        exitCode: 0,
        stdout: [
          'Scanning repository...',
          'Detecting architecture...',
          'Generating AI memory...',
          'Done.',
        ],
        stderr: [],
      });
      expect((await readdir(join(dir, '.recall'))).sort()).toEqual(['agents', 'memory.json']);
    },
    integrationTestTimeout,
  );

  it(
    'exits 4 and changes nothing when .recall/ exists and --force is absent',
    async () => {
      await run('init', dir);
      const result = await run('init', dir);
      expect(result.exitCode).toBe(4);
      expect(result.stdout).toEqual([]);
      expect(result.stderr.join('\n')).toMatch(/already exists.*--force/);
    },
    integrationTestTimeout,
  );

  it(
    'regenerates with --force',
    async () => {
      await run('init', dir);
      expect((await run('init', dir, '--force')).exitCode).toBe(0);
    },
    integrationTestTimeout,
  );

  it('exits 3 for a path that does not exist, before printing any progress', async () => {
    const result = await run('init', join(dir, 'nope'));
    expect(result.exitCode).toBe(3);
    expect(result.stdout).toEqual([]);
    expect(result.stderr[0]).toMatch(/^error: Path does not exist/);
  });

  it(
    'exits 5 for a symlinked .recall',
    async () => {
      const outside = await createTempDir('recall-outside-');
      try {
        await createDirLink(outside, join(dir, '.recall'));
        const result = await run('init', dir, '--force');
        expect(result.exitCode).toBe(5);
        expect(result.stderr[0]).toMatch(/symlink/);
      } finally {
        await removeTempDir(outside);
      }
    },
    integrationTestTimeout,
  );

  it('exits 2 for invalid usage, with no stack trace', async () => {
    const result = await run('init', '--verbose');
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toEqual([
      'error: Unknown option "--verbose". The only option is "--force".',
    ]);
  });

  it('prints help to stdout with exit 0, documenting one command and one flag', async () => {
    const result = await run('--help');
    expect(result).toEqual({ exitCode: 0, stdout: [HELP_TEXT], stderr: [] });
    expect(HELP_TEXT).toContain('recall init [path] [--force]');
  });

  it('prints the version as recall/<version>', async () => {
    const result = await run('--version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout[0]).toMatch(/^recall\/\d+\.\d+\.\d+/);
  });
});

describe('reportFailure', () => {
  function capture(debug: boolean) {
    const stderr: string[] = [];
    return {
      stderr,
      io: { stdout: () => undefined, stderr: (line: string) => stderr.push(line), debug },
    };
  }

  it('prints a deliberate RecallError as one line and returns its own exit code', () => {
    const { stderr, io } = capture(false);
    expect(reportFailure(io, new InvalidPathError('Path does not exist: /x'))).toBe(3);
    expect(stderr).toEqual(['error: Path does not exist: /x']);
  });

  it('reports an unexpected error with exit 1 and no stack trace by default', () => {
    const { stderr, io } = capture(false);
    expect(reportFailure(io, new Error('disk on fire'))).toBe(1);
    expect(stderr).toEqual([
      'error: Unexpected failure: disk on fire',
      'Set RECALL_DEBUG=1 to include a stack trace.',
    ]);
  });

  it('includes the stack trace only in debug mode', () => {
    const { stderr, io } = capture(true);
    reportFailure(io, new Error('disk on fire'));
    expect(stderr[1]).toMatch(/^Error: disk on fire\n\s+at /);
  });
});

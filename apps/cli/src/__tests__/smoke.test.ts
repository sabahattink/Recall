import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import {
  REFERENCE_FIXTURES,
  createTempDir,
  integrationTestTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const cliEntry = join(here, '..', '..', 'dist', 'index.js');

const EXPECTED_STDOUT = [
  'Scanning repository...',
  'Detecting architecture...',
  'Generating AI memory...',
  'Done.',
  '',
].join('\n');

async function runCompiledCli(args: string[], cwd?: string) {
  return execa(process.execPath, [cliEntry, ...args], {
    reject: false,
    cwd,
    stripFinalNewline: false,
  });
}

async function listTree(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? listTree(join(dir, entry.name), `${prefix}${entry.name}/`)
        : Promise.resolve([`${prefix}${entry.name}`]),
    ),
  );
  return nested.flat().sort();
}

/**
 * End-to-end tests of the compiled CLI as a subprocess (CLI-07): the real
 * entry point, real argument handling, real stdout/stderr and exit codes,
 * against every reference fixture.
 */
describe('recall (compiled subprocess)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it.each(REFERENCE_FIXTURES.map((fixture) => [fixture.name, fixture] as const))(
    'initializes the "%s" fixture with the exact output contract',
    async (_name, fixture) => {
      await fixture.build(dir);

      const result = await runCompiledCli(['init'], dir);

      expect(result.stderr).toBe('');
      expect(result.stdout).toBe(EXPECTED_STDOUT);
      expect(result.exitCode).toBe(0);
      expect(await listTree(join(dir, '.recall'))).toEqual([
        'agents/claude.md',
        'agents/codex.md',
        'agents/cursor.md',
        'agents/gemini.md',
        'agents/openai.md',
        'memory.json',
      ]);
    },
    integrationTestTimeout * 2,
  );

  it(
    'refuses a second run without --force (exit 4) and accepts it with --force',
    async () => {
      await REFERENCE_FIXTURES[0]?.build(dir);
      expect((await runCompiledCli(['init', dir])).exitCode).toBe(0);
      expect((await runCompiledCli(['init', dir])).exitCode).toBe(4);
      expect((await runCompiledCli(['init', dir, '--force'])).exitCode).toBe(0);
    },
    integrationTestTimeout * 2,
  );

  it('exits 2 for an unknown command without printing a stack trace', async () => {
    const result = await runCompiledCli(['status']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });
});

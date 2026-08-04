import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSimpleNodeFixture,
  commitAll,
  createTempDir,
  initGitRepo,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { runCli } from '../cli.js';

function argv(...args: string[]): string[] {
  return ['node', 'recall', ...args];
}

async function run(
  ...args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number | undefined }> {
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  // cac's built-in --help/--version output goes through console.log, which
  // Node binds to the real process.stdout independently of spying on
  // `process.stdout.write`, so it is captured separately here.
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  process.exitCode = undefined;
  await runCli(argv(...args));
  const stdout = [
    ...stdoutSpy.mock.calls.map((call) => String(call[0])),
    ...consoleSpy.mock.calls.map((call) => call.join(' ')),
  ].join('');
  const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join('');
  const exitCode = process.exitCode;
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  consoleSpy.mockRestore();
  process.exitCode = undefined;
  return { stdout, stderr, exitCode };
}

describe('recall CLI (in-process)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await buildSimpleNodeFixture(dir);
    await initGitRepo(dir);
    await commitAll(dir, 'chore: initial commit');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('recall --version prints the version', async () => {
    const result = await run('--version');
    expect(result.stdout.trim().length).toBeGreaterThan(0);
    expect(result.exitCode ?? 0).toBe(0);
  });

  it('recall --help prints usage', async () => {
    const result = await run('--help');
    expect(result.stdout).toContain('recall');
  });

  it('recall --help advertises the `recall` command name, not the `cli` package-name segment', async () => {
    const result = await run('--help');
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('$ recall <command>');
    expect(result.stdout).not.toContain('$ cli <command>');
  });

  it('recall init creates the .recall directory and exits 0', async () => {
    const result = await run('init', '--path', dir);
    expect(result.exitCode ?? 0).toBe(0);
    await expect(access(join(dir, '.recall', 'manifest.json'))).resolves.toBeUndefined();
  });

  it('recall init --dry-run writes nothing', async () => {
    const result = await run('init', '--path', dir, '--dry-run');
    expect(result.exitCode ?? 0).toBe(0);
    await expect(access(join(dir, '.recall'))).rejects.toThrow();
  });

  it('recall status exits 3 before init and 0 after', async () => {
    const before = await run('status', '--path', dir);
    expect(before.exitCode).toBe(3);

    await run('init', '--path', dir);
    const after = await run('status', '--path', dir);
    expect(after.exitCode ?? 0).toBe(0);
  });

  it('recall scan --json prints a parseable snapshot', async () => {
    const result = await run('scan', '--path', dir, '--json');
    expect(result.exitCode ?? 0).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.schemaVersion).toBe('1.0.0');
  });

  it('recall update --check exits 4 when memory is stale', async () => {
    await run('init', '--path', dir);
    await writeFile(join(dir, 'src', 'new.js'), 'module.exports = {};\n', 'utf8');
    await commitAll(dir, 'feat: add file');

    const result = await run('update', '--path', dir, '--check');
    expect(result.exitCode).toBe(4);
  });

  it('recall context --stdout prints markdown without writing a file', async () => {
    await run('init', '--path', dir);
    const result = await run('context', '--path', dir, '--stdout');
    expect(result.exitCode ?? 0).toBe(0);
    expect(result.stdout).toContain('# Recall Context');
    await expect(access(join(dir, '.recall', 'context.md'))).rejects.toThrow();
  });

  it('recall doctor exits non-zero before init', async () => {
    const result = await run('doctor', '--path', dir);
    expect(result.exitCode).toBe(3);
  });

  it('recall explain reports on a known file after init', async () => {
    await run('init', '--path', dir);
    const result = await run('explain', 'src/users/create-user.js', '--path', dir);
    expect(result.exitCode ?? 0).toBe(0);
    expect(result.stdout).toContain('Likely responsibility');
  });

  it('rejects an unknown path with invalid usage exit code', async () => {
    const result = await run('--path', '/definitely/not/a/real/path', 'status');
    expect(result.exitCode).toBe(2);
  });
});

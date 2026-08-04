import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import {
  buildSimpleNodeFixture,
  commitAll,
  createTempDir,
  initGitRepo,
  removeTempDir,
} from '@recall-ai/test-fixtures';

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, '..', '..');

interface PackedFile {
  path: string;
}

interface PackResult {
  filename: string;
  files: PackedFile[];
}

/**
 * End-to-end proof that `recall-context` is actually publishable: runs the
 * real `npm pack` (exercising prepack's build+bundle+devDependency-stripping
 * pipeline), then installs the resulting tarball into a clean consumer
 * project outside the monorepo — the same way a real user would via
 * `npx recall-context init` — and drives the installed `recall` binary
 * against a throwaway fixture repository.
 */
describe('npm packaging (packed tarball, clean consumer install)', () => {
  let tarballPath: string;
  let packedFiles: string[];
  let consumerDir: string;
  let fixtureDir: string;
  let publishedManifest: Record<string, unknown>;

  beforeAll(async () => {
    const packResult = await execa('npm', ['pack', '--json'], { cwd: cliRoot });
    const [packInfo] = JSON.parse(packResult.stdout) as PackResult[];
    if (!packInfo) throw new Error('npm pack --json returned no package info');
    tarballPath = join(cliRoot, packInfo.filename);
    packedFiles = packInfo.files.map((f) => f.path);

    consumerDir = await createTempDir('recall-consumer-');
    await execa('git', ['init'], { cwd: consumerDir });
    await execa('npm', ['init', '-y'], { cwd: consumerDir });
    await execa('npm', ['install', tarballPath], { cwd: consumerDir });

    const installedManifestPath = join(
      consumerDir,
      'node_modules',
      'recall-context',
      'package.json',
    );
    publishedManifest = JSON.parse(readFileSync(installedManifestPath, 'utf8'));

    fixtureDir = await createTempDir('recall-consumer-fixture-');
    await buildSimpleNodeFixture(fixtureDir);
    await initGitRepo(fixtureDir);
    await commitAll(fixtureDir, 'chore: initial commit');
  }, 180_000);

  afterAll(async () => {
    if (tarballPath && existsSync(tarballPath)) rmSync(tarballPath);
    if (consumerDir) await removeTempDir(consumerDir);
    if (fixtureDir) await removeTempDir(fixtureDir);
  });

  function recallBin(...args: string[]) {
    const bin = join(
      consumerDir,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'recall.cmd' : 'recall',
    );
    return execa(bin, args, { cwd: consumerDir, reject: false });
  }

  it('packs exactly the expected files', () => {
    expect(packedFiles.sort()).toEqual(['LICENSE', 'README.md', 'dist/index.js', 'package.json']);
  });

  it('contains no workspace:* dependencies in the packed manifest', () => {
    const manifestText = JSON.stringify(publishedManifest);
    expect(manifestText).not.toContain('workspace:');
  });

  it('exposes an executable named exactly "recall"', () => {
    expect(Object.keys(publishedManifest.bin as Record<string, string>)).toEqual(['recall']);
  });

  it('the installed CLI version matches the packed package version', async () => {
    const result = await recallBin('--version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`recall/${publishedManifest.version}`);
  });

  it('runs --help from the installed tarball with no workspace resolution', async () => {
    const result = await recallBin('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('$ recall <command>');
  });

  it('runs init, status, context, and doctor against a fixture using only the installed tarball', async () => {
    const init = await recallBin('init', '--path', fixtureDir);
    expect(init.exitCode).toBe(0);
    expect(existsSync(join(fixtureDir, '.recall', 'manifest.json'))).toBe(true);

    const status = await recallBin('status', '--path', fixtureDir);
    expect(status.exitCode).toBe(0);

    const context = await recallBin('context', '--path', fixtureDir, '--stdout');
    expect(context.exitCode).toBe(0);
    expect(context.stdout).toContain('# Recall Context');

    const doctor = await recallBin('doctor', '--path', fixtureDir);
    expect(doctor.exitCode).toBe(0);
  }, 60_000);
});

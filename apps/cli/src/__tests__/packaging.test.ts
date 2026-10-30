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
    // Deleting the consumer's node_modules is slow on Windows runners.
  }, 120_000);

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
    expect(result.stdout).toContain('recall init [path] [--force]');
  });

  it('runs init against a fixture using only the installed tarball', async () => {
    const init = await recallBin('init', fixtureDir);
    expect(init.stderr).toBe('');
    expect(init.stdout.split(/\r?\n/).filter(Boolean)).toEqual([
      'Scanning repository...',
      'Detecting architecture...',
      'Generating AI memory...',
      'Done.',
    ]);
    expect(init.exitCode).toBe(0);
    for (const file of ['memory.json', 'agents/claude.md', 'agents/openai.md']) {
      expect(existsSync(join(fixtureDir, '.recall', ...file.split('/')))).toBe(true);
    }

    const again = await recallBin('init', fixtureDir);
    expect(again.exitCode).toBe(4);
  }, 60_000);

  it('declares the Node.js 22+ requirement in the published manifest', () => {
    expect((publishedManifest.engines as Record<string, string>).node).toBe('>=22');
  });

  describe('release verification (exact-version assertions)', () => {
    // Hard-coded to the version this release is expected to carry, not read
    // from package.json — the whole point of these tests is to fail loudly
    // if the on-disk version and the intended release version ever diverge.
    const EXPECTED_VERSION = '0.2.0-alpha.1';

    it('apps/cli/package.json version is exact', () => {
      const localManifest = JSON.parse(
        readFileSync(join(cliRoot, 'package.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(localManifest.version).toBe(EXPECTED_VERSION);
    });

    it('the packed manifest version is exact', () => {
      expect(publishedManifest.version).toBe(EXPECTED_VERSION);
    });

    it('the tarball filename is exact', () => {
      expect(tarballPath.endsWith(`recall-context-${EXPECTED_VERSION}.tgz`)).toBe(true);
    });

    it('the installed CLI reports the exact version string', async () => {
      const result = await recallBin('--version');
      expect(result.stdout.trim()).toContain(`recall/${EXPECTED_VERSION}`);
    });

    it('the publishable manifest has no provenance=true left in publishConfig', () => {
      const publishConfig = publishedManifest.publishConfig as Record<string, unknown> | undefined;
      expect(publishConfig?.provenance).not.toBe(true);
    });

    it('the bin target resolves to a real, executable file inside the tarball', () => {
      const bin = publishedManifest.bin as Record<string, string>;
      const binTarget = join(consumerDir, 'node_modules', 'recall-context', bin.recall as string);
      expect(existsSync(binTarget)).toBe(true);
      expect(packedFiles).toContain(bin.recall);
    });

    it('dist/index.js begins with the canonical shebang, byte-for-byte', () => {
      const distEntry = join(consumerDir, 'node_modules', 'recall-context', 'dist', 'index.js');
      const bytes = readFileSync(distEntry);
      const canonical = Buffer.from('#!/usr/bin/env node\n', 'utf8');
      expect(bytes.subarray(0, canonical.length).equals(canonical)).toBe(true);
    });
  });
});

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
const localManifest = JSON.parse(readFileSync(join(cliRoot, 'package.json'), 'utf8')) as Record<
  string,
  unknown
>;
const EXPECTED_VERSION = String(localManifest.version);

interface PackedFile {
  path: string;
}

interface PackResult {
  filename: string;
  files: PackedFile[];
}

const REGISTRY_ENV = {
  ...process.env,
  npm_config_fetch_retries: '0',
  npm_config_fetch_timeout: '5000',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
};

const REGISTRY_UNAVAILABLE =
  'npm registry is unavailable; skipping clean-consumer install assertions';

function networkFailureText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  const record = error as Record<string, unknown>;
  return [record.shortMessage, record.message, record.stderr]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
}

function isRegistryNetworkFailure(error: unknown): boolean {
  const text = networkFailureText(error);
  return /EAI_AGAIN|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network|fetch failed|socket hang up/i.test(
    text,
  );
}

/**
 * End-to-end proof that `recall-context` is actually publishable. The pack
 * step (prepack's build+bundle+devDependency-stripping pipeline) is fully
 * local and always runs. Installing the tarball into a clean consumer
 * project outside the monorepo — the same way a real user would via
 * `npx recall-context init` — needs npm registry access for the package's
 * third-party runtime dependencies; the registry is probed with a short
 * timeout and only the consumer assertions are skipped when it is
 * unavailable, instead of hanging until the hook timeout.
 */
describe('npm packaging (packed tarball, clean consumer install)', () => {
  let tarballPath = '';
  let packedFiles: string[] = [];
  let consumerDir = '';
  let fixtureDir = '';
  let publishedManifest: Record<string, unknown> | null = null;
  let consumerUnavailableReason: string | null = null;

  beforeAll(async () => {
    const packResult = await execa('npm', ['pack', '--json'], { cwd: cliRoot });
    const [packInfo] = JSON.parse(packResult.stdout) as PackResult[];
    if (!packInfo) throw new Error('npm pack --json returned no package info');
    tarballPath = join(cliRoot, packInfo.filename);
    packedFiles = packInfo.files.map((file) => file.path);

    consumerDir = await createTempDir('recall-consumer-');
    await execa('git', ['init'], { cwd: consumerDir });
    await execa('npm', ['init', '-y'], { cwd: consumerDir });

    try {
      const ping = await execa('npm', ['ping', '--silent'], {
        cwd: consumerDir,
        env: REGISTRY_ENV,
        reject: false,
        timeout: 8_000,
      });
      if (ping.exitCode !== 0) {
        consumerUnavailableReason = REGISTRY_UNAVAILABLE;
        return;
      }
    } catch {
      consumerUnavailableReason = REGISTRY_UNAVAILABLE;
      return;
    }

    try {
      const install = await execa(
        'npm',
        [
          'install',
          tarballPath,
          '--no-audit',
          '--no-fund',
          '--package-lock=false',
          '--ignore-scripts',
        ],
        { cwd: consumerDir, env: REGISTRY_ENV, reject: false, timeout: 60_000 },
      );
      if (install.exitCode !== 0) {
        const errorText = [install.stdout, install.stderr].join('\n');
        if (isRegistryNetworkFailure({ message: errorText })) {
          consumerUnavailableReason = REGISTRY_UNAVAILABLE;
          return;
        }
        throw new Error(`npm install of packed tarball failed:\n${errorText}`);
      }
    } catch (error) {
      if (isRegistryNetworkFailure(error)) {
        consumerUnavailableReason = REGISTRY_UNAVAILABLE;
        return;
      }
      throw error;
    }

    const installedManifestPath = join(
      consumerDir,
      'node_modules',
      'recall-context',
      'package.json',
    );
    publishedManifest = JSON.parse(readFileSync(installedManifestPath, 'utf8')) as Record<
      string,
      unknown
    >;

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

  function requireConsumer(skip: (reason?: string) => void): Record<string, unknown> {
    if (consumerUnavailableReason) skip(consumerUnavailableReason);
    if (!publishedManifest) throw new Error('consumer install did not produce a package manifest');
    return publishedManifest;
  }

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

  it('contains no workspace:* dependencies in the packed manifest', ({ skip }) => {
    const manifest = requireConsumer(skip);
    expect(JSON.stringify(manifest)).not.toContain('workspace:');
  });

  it('exposes the documented executables', ({ skip }) => {
    const manifest = requireConsumer(skip);
    expect(Object.keys(manifest.bin as Record<string, string>)).toEqual([
      'recall',
      'recall-context',
    ]);
  });

  it('runs the README npx command from the installed tarball', async ({ skip }) => {
    const manifest = requireConsumer(skip);
    const result = await execa('npx', ['--no-install', 'recall-context', '--version'], {
      cwd: consumerDir,
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`recall/${String(manifest.version)}`);
  });

  it('the installed CLI version matches the packed package version', async ({ skip }) => {
    const manifest = requireConsumer(skip);
    const result = await recallBin('--version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`recall/${String(manifest.version)}`);
  });

  it('runs --help from the installed tarball with no workspace resolution', async ({ skip }) => {
    requireConsumer(skip);
    const result = await recallBin('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('recall init [path] [--force]');
  });

  it('runs init against a fixture using only the installed tarball', async ({ skip }) => {
    requireConsumer(skip);
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

  it('declares the Node.js 22+ requirement in the published manifest', ({ skip }) => {
    const manifest = requireConsumer(skip);
    expect((manifest.engines as Record<string, string>).node).toBe('>=22');
  });

  describe('release verification (version consistency assertions)', () => {
    it('apps/cli/package.json version is a concrete semver-like version', () => {
      expect(EXPECTED_VERSION).toMatch(/^\d+\.\d+\.\d+(?:[-+].+)?$/);
    });

    it('the packed manifest version matches the source package version', ({ skip }) => {
      const manifest = requireConsumer(skip);
      expect(manifest.version).toBe(EXPECTED_VERSION);
    });

    it('the tarball filename matches the source package version', () => {
      expect(tarballPath.endsWith(`recall-context-${EXPECTED_VERSION}.tgz`)).toBe(true);
    });

    it('the installed CLI reports the source package version string', async ({ skip }) => {
      requireConsumer(skip);
      const result = await recallBin('--version');
      expect(result.stdout.trim()).toContain(`recall/${EXPECTED_VERSION}`);
    });

    it('the publishable manifest has no provenance=true left in publishConfig', ({ skip }) => {
      const manifest = requireConsumer(skip);
      const publishConfig = manifest.publishConfig as Record<string, unknown> | undefined;
      expect(publishConfig?.provenance).not.toBe(true);
    });

    it('the bin target resolves to a real, executable file inside the tarball', ({ skip }) => {
      const manifest = requireConsumer(skip);
      const bin = manifest.bin as Record<string, string>;
      const binTarget = join(consumerDir, 'node_modules', 'recall-context', bin.recall as string);
      expect(existsSync(binTarget)).toBe(true);
      expect(packedFiles).toContain(bin.recall);
    });

    it('dist/index.js begins with the canonical shebang, byte-for-byte', ({ skip }) => {
      requireConsumer(skip);
      const distEntry = join(consumerDir, 'node_modules', 'recall-context', 'dist', 'index.js');
      const bytes = readFileSync(distEntry);
      const canonical = Buffer.from('#!/usr/bin/env node\n', 'utf8');
      expect(bytes.subarray(0, canonical.length).equals(canonical)).toBe(true);
    });
  });
});

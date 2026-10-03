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
const localManifest = JSON.parse(
  readFileSync(join(cliRoot, 'package.json'), 'utf8'),
) as Record<string, unknown>;
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
 * step is fully local and always runs. Clean-consumer installation requires
 * npm registry access for the package's third-party runtime dependencies; CI
 * probes that access with a short timeout and cleanly skips only those
 * consumer assertions when the registry is unavailable instead of hanging
 * for the old 180-second hook timeout.
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
        consumerUnavailableReason =
          'npm registry is unavailable; skipping clean-consumer install assertions';
        return;
      }
    } catch {
      consumerUnavailableReason =
        'npm registry is unavailable; skipping clean-consumer install assertions';
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
        {
          cwd: consumerDir,
          env: REGISTRY_ENV,
          reject: false,
          timeout: 60_000,
        },
      );
      if (install.exitCode !== 0) {
        const errorText = [install.stdout, install.stderr].join('\n');
        if (isRegistryNetworkFailure({ message: errorText })) {
          consumerUnavailableReason =
            'npm registry became unavailable; skipping clean-consumer install assertions';
          return;
        }
        throw new Error(`npm install of packed tarball failed:\n${errorText}`);
      }
    } catch (error) {
      if (isRegistryNetworkFailure(error)) {
        consumerUnavailableReason =
          'npm registry became unavailable; skipping clean-consumer install assertions';
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
  }, 90_000);

  afterAll(async () => {
    if (tarballPath && existsSync(tarballPath)) rmSync(tarballPath);
    if (consumerDir) await removeTempDir(consumerDir);
    if (fixtureDir) await removeTempDir(fixtureDir);
  });

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
    expect(result.stdout).toContain(`recall/${manifest.version}`);
  });

  it('the installed CLI version matches the packed package version', async ({ skip }) => {
    const manifest = requireConsumer(skip);
    const result = await recallBin('--version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`recall/${manifest.version}`);
  });

  it('runs --help from the installed tarball with no workspace resolution', async ({ skip }) => {
    requireConsumer(skip);
    const result = await recallBin('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('$ recall <command>');
  });

  it(
    'runs init, status, context, and doctor against a fixture using only the installed tarball',
    async ({ skip }) => {
      requireConsumer(skip);
      const init = await recallBin('init', '--path', fixtureDir);
      expect(init.exitCode).toBe(0);
      expect(existsSync(join(fixtureDir, '.recall', 'manifest.json'))).toBe(true);

      const status = await recallBin('status', '--path', fixtureDir);
      expect(status.exitCode).toBe(0);
      expect(status.stdout).toContain('Status: ok');

      const context = await recallBin('context', '--path', fixtureDir, '--stdout');
      expect(context.exitCode).toBe(0);
      expect(context.stdout).toContain('# Recall Context');

      const doctor = await recallBin('doctor', '--path', fixtureDir);
      expect(doctor.exitCode).toBe(0);
      expect(doctor.stdout).toContain('[PASS] Memory freshness');
    },
    60_000,
  );

  it('reports a consistent Node.js 22+ requirement across package metadata and doctor output', async ({
    skip,
  }) => {
    const manifest = requireConsumer(skip);
    expect((manifest.engines as Record<string, string>).node).toBe('>=22');

    const doctor = await recallBin('doctor', '--path', fixtureDir);
    const runtimeLine = doctor.stdout
      .split('\n')
      .find((line) => line.includes('Node.js runtime version'));
    expect(runtimeLine).toContain('Node.js 22+');
    expect(runtimeLine).not.toContain('18+');
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

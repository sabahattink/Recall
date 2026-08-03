import { describe, expect, it } from 'vitest';
import { detectRisks, type RiskContext } from '../risks.js';

function baseContext(overrides: Partial<RiskContext> = {}): RiskContext {
  return {
    root: '/repo',
    files: [],
    workspaces: [],
    internalEdges: [],
    ecosystem: {
      packageManager: 'pnpm',
      packageManagerVersion: null,
      nodeVersionRange: '>=20',
      isMonorepo: false,
      workspaceGlobs: [],
      hasTypescript: true,
      hasLockfile: true,
      lockfilePath: 'pnpm-lock.yaml',
    },
    dependencies: [],
    dockerFiles: [],
    testFileCount: 1,
    gitTrackedFiles: null,
    ...overrides,
  };
}

describe('detectRisks', () => {
  it('flags missing tests when source files exist but no tests do', async () => {
    const context = baseContext({
      files: [{ path: 'src/index.ts', sizeBytes: 100, extension: '.ts' }],
      testFileCount: 0,
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'missing-tests')).toBe(true);
  });

  it('does not flag missing tests when test files exist', async () => {
    const context = baseContext({
      files: [{ path: 'src/index.ts', sizeBytes: 100, extension: '.ts' }],
      testFileCount: 3,
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'missing-tests')).toBe(false);
  });

  it('detects a circular workspace dependency', async () => {
    const context = baseContext({
      internalEdges: [
        { from: 'packages/a', to: 'packages/b', kind: 'workspace', evidence: [] },
        { from: 'packages/b', to: 'packages/a', kind: 'workspace', evidence: [] },
      ],
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'circular-dependency')).toBe(true);
  });

  it('flags very large source files', async () => {
    const context = baseContext({
      files: [{ path: 'src/huge.ts', sizeBytes: 200 * 1024, extension: '.ts' }],
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'large-file')).toBe(true);
  });

  it('flags deeply coupled workspaces', async () => {
    const context = baseContext({
      workspaces: [
        {
          info: {
            name: 'app',
            path: 'apps/app',
            kind: 'app',
            version: '1.0.0',
            private: true,
            dependsOn: ['a', 'b', 'c', 'd', 'e'],
            main: null,
            scripts: {},
          },
          absolutePath: '/repo/apps/app',
          packageJson: {},
        },
      ],
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'deep-coupling')).toBe(true);
  });

  it('flags committed .env files but not .env.example', async () => {
    const context = baseContext({
      files: [
        { path: '.env', sizeBytes: 20, extension: '' },
        { path: '.env.example', sizeBytes: 20, extension: '' },
      ],
    });
    const risks = await detectRisks(context);
    const envRisks = risks.filter((r) => r.category === 'committed-env-file');
    expect(envRisks).toHaveLength(1);
    expect(envRisks[0]?.evidence[0]?.path).toBe('.env');
  });

  it('flags an unsupported (very old) Node.js engine range', async () => {
    const context = baseContext({
      ecosystem: { ...baseContext().ecosystem, nodeVersionRange: '>=12' },
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'unsupported-runtime')).toBe(true);
  });

  it('flags duplicate dependency versions across the repository', async () => {
    const context = baseContext({
      dependencies: [
        { name: 'lodash', version: '^4.17.21', scope: 'dependency', workspace: 'apps/a' },
        { name: 'lodash', version: '^3.10.1', scope: 'dependency', workspace: 'apps/b' },
      ],
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'duplicate-dependency-version')).toBe(true);
  });

  it('flags a missing lockfile', async () => {
    const context = baseContext({
      ecosystem: { ...baseContext().ecosystem, hasLockfile: false, lockfilePath: null },
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'missing-lockfile')).toBe(true);
  });

  it('flags suspicious tracking of generated files when git data is provided', async () => {
    const context = baseContext({
      gitTrackedFiles: ['dist/index.js', 'src/index.ts'],
    });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'suspicious-generated-file-tracking')).toBe(true);
  });

  it('does not flag generated-file tracking when git data is unavailable', async () => {
    const context = baseContext({ gitTrackedFiles: null });
    const risks = await detectRisks(context);
    expect(risks.some((r) => r.category === 'suspicious-generated-file-tracking')).toBe(false);
  });
});

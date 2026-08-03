import type { RepositorySnapshot } from '@recall-ai/schemas';

export function makeSnapshot(overrides: Partial<RepositorySnapshot> = {}): RepositorySnapshot {
  return {
    schemaVersion: '1.0.0',
    repository: { name: 'example', root: '.', description: null },
    git: null,
    ecosystem: {
      packageManager: 'pnpm',
      packageManagerVersion: null,
      nodeVersionRange: null,
      isMonorepo: false,
      workspaceGlobs: [],
      hasTypescript: true,
      hasLockfile: true,
      lockfilePath: 'pnpm-lock.yaml',
    },
    workspaces: [],
    files: [],
    entryPoints: [],
    dependencies: [],
    internalEdges: [],
    frameworks: [],
    conventions: [],
    risks: [],
    testing: { frameworks: [], testFiles: [] },
    ci: { detected: false, providers: [], configFiles: [] },
    docker: { detected: false, files: [] },
    serviceIntegrations: [],
    generatedFiles: [],
    ignoredDirectories: [],
    generatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

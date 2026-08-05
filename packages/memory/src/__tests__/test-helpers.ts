import type { FileRecord, RepositorySnapshot } from '@recall-ai/schemas';

export function makeFile(overrides: Partial<FileRecord> & { path: string }): FileRecord {
  const extension = overrides.extension ?? `.${overrides.path.split('.').pop()}`;
  return {
    workspace: null,
    kind: 'source',
    sizeBytes: 100,
    extension,
    ...overrides,
  };
}

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

import { basename, join } from 'node:path';
import type { GitMetadata, RepositorySnapshot } from '@recall-ai/schemas';
import { walkRepository } from './file-walk.js';
import { detectEcosystem } from './package-manager.js';
import { discoverWorkspaces } from './workspaces.js';
import { detectFrameworks } from './frameworks.js';
import { detectEntryPoints } from './entry-points.js';
import { collectDependencies } from './dependencies.js';
import { buildImportGraph } from './import-graph.js';
import { detectConventions } from './conventions.js';
import { detectRisks } from './risks.js';
import { detectCi, detectDocker } from './ci-docker.js';
import { detectServiceIntegrations } from './service-integrations.js';
import { detectTesting } from './testing.js';
import { classifyFiles } from './file-classification.js';
import {
  DEFAULT_IGNORED_DIRECTORIES,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_FILE_SIZE_BYTES,
} from './constants.js';
import { readJsonIfExists } from './json.js';

export interface ScanOptions {
  maxFiles?: number;
  maxFileSizeBytes?: number;
  gitMetadata?: GitMetadata | null;
  /** Result of `git ls-files`, used only for the generated-file-tracking risk rule. */
  gitTrackedFiles?: string[] | null;
  signal?: AbortSignal;
}

export interface ScanResult {
  snapshot: RepositorySnapshot;
  truncated: boolean;
}

export async function scanRepository(root: string, options: ScanOptions = {}): Promise<ScanResult> {
  const rootPackageJson = await readJsonIfExists<{ name?: string; description?: string }>(
    join(root, 'package.json'),
  );

  const [{ files: walkedFiles, truncated }, ecosystem] = await Promise.all([
    walkRepository(root, {
      maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
      maxFileSizeBytes: options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES,
    }),
    detectEcosystem(root),
  ]);

  throwIfAborted(options.signal);

  const workspaces = await discoverWorkspaces(root, ecosystem.workspaceGlobs);
  const files = classifyFiles(walkedFiles, workspaces);
  const frameworks = await detectFrameworks(root, workspaces);
  const entryPoints = await detectEntryPoints(workspaces, frameworks);
  const dependencies = collectDependencies(workspaces);
  const internalEdges = await buildImportGraph(root, walkedFiles, workspaces);
  const conventions = await detectConventions(root, walkedFiles, workspaces);
  const ci = detectCi(walkedFiles);
  const docker = detectDocker(walkedFiles);
  const serviceIntegrations = detectServiceIntegrations(dependencies);
  const testing = detectTesting(walkedFiles, dependencies);

  throwIfAborted(options.signal);

  const risks = await detectRisks({
    root,
    files: walkedFiles,
    workspaces,
    internalEdges,
    ecosystem,
    dependencies,
    dockerFiles: docker.files,
    testFileCount: testing.testFiles.length,
    gitTrackedFiles: options.gitTrackedFiles ?? null,
  });

  const generatedFiles = files.filter((f) => f.kind === 'generated').map((f) => f.path);

  const snapshot: RepositorySnapshot = {
    schemaVersion: '1.0.0',
    repository: {
      name: rootPackageJson?.name ?? basename(root),
      root,
      description: rootPackageJson?.description ?? null,
    },
    git: options.gitMetadata ?? null,
    ecosystem,
    workspaces: workspaces.map((w) => w.info),
    files,
    entryPoints,
    dependencies,
    internalEdges,
    frameworks,
    conventions,
    risks,
    testing,
    ci,
    docker,
    serviceIntegrations,
    generatedFiles,
    ignoredDirectories: [...DEFAULT_IGNORED_DIRECTORIES],
    generatedAt: new Date().toISOString(),
  };

  return { snapshot, truncated };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Scan was cancelled', 'AbortError');
  }
}

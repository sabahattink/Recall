import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTempDir, removeTempDir, writeTree } from '@recall-ai/test-fixtures';
import { detectEcosystem } from '../package-manager.js';
import { discoverWorkspaces } from '../workspaces.js';
import { walkRepository } from '../file-walk.js';
import { buildImportGraph } from '../import-graph.js';

describe('buildImportGraph: dependency edge classification', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir();
    await writeTree(dir, {
      'package.json': JSON.stringify({ name: 'root', private: true }),
      'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n",
      'packages/app/package.json': JSON.stringify({
        name: '@fixture/app',
        version: '1.0.0',
        dependencies: { '@fixture/core': 'workspace:*' },
        devDependencies: { '@fixture/test-utils': 'workspace:*' },
      }),
      'packages/app/src/index.ts': [
        "import { helper } from '../../core/src/index.js';",
        "import { probe } from '../../test-utils/src/index.js';",
        'export const run = () => helper() + probe();',
      ].join('\n'),
      'packages/app/src/__tests__/index.test.ts': [
        "import { run } from '../index.js';",
        'run();',
      ].join('\n'),
      'packages/core/package.json': JSON.stringify({ name: '@fixture/core', version: '1.0.0' }),
      'packages/core/src/index.ts': 'export function helper() { return 1; }',
      'packages/test-utils/package.json': JSON.stringify({
        name: '@fixture/test-utils',
        version: '1.0.0',
      }),
      'packages/test-utils/src/index.ts': 'export function probe() { return 2; }',
    });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('classifies a package.json "dependencies" edge as runtime and "devDependencies" as development', async () => {
    const ecosystem = await detectEcosystem(dir);
    const workspaces = await discoverWorkspaces(dir, ecosystem.workspaceGlobs);
    const { files } = await walkRepository(dir);
    const { edges } = await buildImportGraph(dir, files, workspaces);

    const runtimeEdge = edges.find(
      (e) => e.kind === 'workspace' && e.from === 'packages/app' && e.to === 'packages/core',
    );
    expect(runtimeEdge?.dependencyType).toBe('runtime');

    const devEdge = edges.find(
      (e) => e.kind === 'workspace' && e.from === 'packages/app' && e.to === 'packages/test-utils',
    );
    expect(devEdge?.dependencyType).toBe('development');
  });

  it('classifies an import edge from a test file as development and from a production file as runtime', async () => {
    const ecosystem = await detectEcosystem(dir);
    const workspaces = await discoverWorkspaces(dir, ecosystem.workspaceGlobs);
    const { files } = await walkRepository(dir);
    const { edges } = await buildImportGraph(dir, files, workspaces);

    const productionImport = edges.find(
      (e) => e.kind === 'import' && e.from === 'packages/app/src/index.ts',
    );
    expect(productionImport?.dependencyType).toBe('runtime');

    const testImport = edges.find(
      (e) => e.kind === 'import' && e.from === 'packages/app/src/__tests__/index.test.ts',
    );
    expect(testImport?.dependencyType).toBe('development');
  });

  it('collects exported top-level symbol names per file in the same read pass', async () => {
    const ecosystem = await detectEcosystem(dir);
    const workspaces = await discoverWorkspaces(dir, ecosystem.workspaceGlobs);
    const { files } = await walkRepository(dir);
    const { symbolsByPath } = await buildImportGraph(dir, files, workspaces);

    expect(symbolsByPath.get('packages/core/src/index.ts')).toEqual(['helper']);
    expect(symbolsByPath.get('packages/test-utils/src/index.ts')).toEqual(['probe']);
  });
});

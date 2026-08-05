import fg from 'fast-glob';
import { dirname, join, relative } from 'node:path';
import type { WorkspaceInfo, WorkspaceKind } from '@recall-ai/schemas';
import { readJsonIfExists } from './json.js';

interface WorkspacePackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface DiscoveredWorkspace {
  info: WorkspaceInfo;
  absolutePath: string;
  packageJson: WorkspacePackageJson;
}

export async function discoverWorkspaces(
  root: string,
  workspaceGlobs: string[],
): Promise<DiscoveredWorkspace[]> {
  const rootPackageJson = await readJsonIfExists<WorkspacePackageJson>(join(root, 'package.json'));

  if (workspaceGlobs.length === 0) {
    return [
      {
        info: {
          name: rootPackageJson?.name ?? 'root',
          path: '.',
          kind: 'root',
          version: rootPackageJson?.version ?? null,
          private: rootPackageJson?.private ?? false,
          dependsOn: [],
          main: rootPackageJson?.main ?? null,
          scripts: rootPackageJson?.scripts ?? {},
        },
        absolutePath: root,
        packageJson: rootPackageJson ?? {},
      },
    ];
  }

  const patterns = workspaceGlobs.map((glob) => `${glob}/package.json`);
  const matches = await fg(patterns, {
    cwd: root,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: ['**/node_modules/**'],
  });
  matches.sort((a, b) => a.localeCompare(b));

  const discovered: DiscoveredWorkspace[] = [];
  for (const match of matches) {
    const absolutePath = join(root, dirname(match));
    const packageJson = await readJsonIfExists<WorkspacePackageJson>(join(root, match));
    if (!packageJson) continue;
    const relativePath = relative(root, absolutePath).split('\\').join('/');
    discovered.push({
      info: {
        name: packageJson.name ?? relativePath,
        path: relativePath,
        kind: inferWorkspaceKind(relativePath),
        version: packageJson.version ?? null,
        private: packageJson.private ?? false,
        dependsOn: [],
        main: packageJson.main ?? null,
        scripts: packageJson.scripts ?? {},
      },
      absolutePath,
      packageJson,
    });
  }

  const names = new Set(discovered.map((workspace) => workspace.info.name));
  for (const workspace of discovered) {
    const allDeps = {
      ...workspace.packageJson.dependencies,
      ...workspace.packageJson.devDependencies,
      ...workspace.packageJson.peerDependencies,
      ...workspace.packageJson.optionalDependencies,
    };
    workspace.info.dependsOn = Object.keys(allDeps)
      .filter((dep) => names.has(dep) && dep !== workspace.info.name)
      .sort();
  }

  return discovered;
}

function inferWorkspaceKind(relativePath: string): WorkspaceKind {
  const segments = relativePath.split('/');
  const topLevel = segments[0] ?? '';
  if (topLevel === 'apps') return 'app';
  if (topLevel === 'services') return 'service';
  return 'package';
}

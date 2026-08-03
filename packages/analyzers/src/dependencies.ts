import type { DependencyRecord } from '@recall-ai/schemas';
import type { DiscoveredWorkspace } from './workspaces.js';

export function collectDependencies(workspaces: DiscoveredWorkspace[]): DependencyRecord[] {
  const records: DependencyRecord[] = [];

  for (const workspace of workspaces) {
    const workspacePath = workspace.info.path === '.' ? null : workspace.info.path;
    const scopes: Array<[Record<string, string> | undefined, DependencyRecord['scope']]> = [
      [workspace.packageJson.dependencies, 'dependency'],
      [workspace.packageJson.devDependencies, 'devDependency'],
      [workspace.packageJson.peerDependencies, 'peerDependency'],
    ];
    for (const [deps, scope] of scopes) {
      if (!deps) continue;
      for (const [name, version] of Object.entries(deps)) {
        records.push({ name, version, scope, workspace: workspacePath });
      }
    }
  }

  records.sort((a, b) => {
    const workspaceCompare = (a.workspace ?? '').localeCompare(b.workspace ?? '');
    if (workspaceCompare !== 0) return workspaceCompare;
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;
    return a.scope.localeCompare(b.scope);
  });

  return records;
}

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { EntryPoint, FrameworkDetection } from '@recall-ai/schemas';
import type { DiscoveredWorkspace } from './workspaces.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const NESTJS_CONVENTIONS = ['src/main.ts'];
const NEXTJS_CONVENTIONS = ['src/app/layout.tsx', 'app/layout.tsx', 'pages/_app.tsx'];

export async function detectEntryPoints(
  workspaces: DiscoveredWorkspace[],
  frameworks: FrameworkDetection[],
): Promise<EntryPoint[]> {
  const entryPoints: EntryPoint[] = [];

  for (const workspace of workspaces) {
    const workspacePath = workspace.info.path === '.' ? null : workspace.info.path;
    const packageJsonPath = join(workspace.info.path, 'package.json').split('\\').join('/');

    const bin = workspace.packageJson as { bin?: string | Record<string, string> };
    if (bin.bin) {
      const binEntries = typeof bin.bin === 'string' ? { [workspace.info.name]: bin.bin } : bin.bin;
      for (const [name, path] of Object.entries(binEntries)) {
        entryPoints.push({
          path: join(workspace.info.path, path).split('\\').join('/'),
          workspace: workspacePath,
          kind: 'bin',
          evidence: [{ path: packageJsonPath, reason: `bin entry "${name}" declared` }],
        });
      }
    }

    if (workspace.packageJson.main) {
      const mainPath = join(workspace.info.path, workspace.packageJson.main).split('\\').join('/');
      entryPoints.push({
        path: mainPath,
        workspace: workspacePath,
        kind: 'main',
        evidence: [{ path: packageJsonPath, reason: 'package.json "main" field' }],
      });
    }

    for (const scriptName of ['start', 'dev']) {
      const command = workspace.packageJson.scripts?.[scriptName];
      if (command) {
        entryPoints.push({
          path: packageJsonPath,
          workspace: workspacePath,
          kind: 'script',
          evidence: [{ path: packageJsonPath, reason: `"${scriptName}" script runs: ${command}` }],
        });
      }
    }

    const workspaceFrameworks = frameworks
      .filter((f) => f.workspace === workspacePath)
      .map((f) => f.name);

    if (workspaceFrameworks.includes('nestjs')) {
      for (const candidate of NESTJS_CONVENTIONS) {
        if (await exists(join(workspace.absolutePath, candidate))) {
          entryPoints.push({
            path: join(workspace.info.path, candidate).split('\\').join('/'),
            workspace: workspacePath,
            kind: 'framework-convention',
            evidence: [{ path: candidate, reason: 'NestJS bootstrap convention (src/main.ts)' }],
          });
        }
      }
    }

    if (workspaceFrameworks.includes('nextjs')) {
      for (const candidate of NEXTJS_CONVENTIONS) {
        if (await exists(join(workspace.absolutePath, candidate))) {
          entryPoints.push({
            path: join(workspace.info.path, candidate).split('\\').join('/'),
            workspace: workspacePath,
            kind: 'framework-convention',
            evidence: [{ path: candidate, reason: 'Next.js root layout/app convention' }],
          });
        }
      }
    }
  }

  return entryPoints;
}

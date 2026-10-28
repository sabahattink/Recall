import { join } from 'node:path';
import type { Fact } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';

interface RootPackageJsonShape {
  workspaces?: string[] | { packages?: string[] };
}

function hasWorkspacesField(packageJson: RootPackageJsonShape): boolean {
  if (Array.isArray(packageJson.workspaces)) return true;
  return (
    typeof packageJson.workspaces === 'object' &&
    packageJson.workspaces !== null &&
    Array.isArray(packageJson.workspaces.packages)
  );
}

/**
 * Detects whether a repository is a single package or a workspace/monorepo,
 * and enumerates member packages, from the file list a prior
 * `walkRepository` call already produced plus one targeted read of the root
 * `package.json` — a file `files` must already confirm exists before it is
 * read, never a blind read of a guessed path.
 *
 * Monorepo evidence is either the root `package.json`'s `workspaces` field
 * (npm/yarn) or the presence of `pnpm-workspace.yaml` (pnpm) — the
 * "workspace manifest field, workspace config file" evidence named in
 * docs/implementation-blueprint.md's SCAN-05 acceptance criteria. Once
 * monorepo evidence is found, every other `package.json` already present in
 * `files` is treated as a member. This deliberately does not match member
 * paths against the workspace globs declared in `workspaces`/
 * `pnpm-workspace.yaml`: SCAN-02's walk already excludes
 * node_modules/dist/build/etc., so any `package.json` that survived it is a
 * real project package, and matching against glob patterns would require
 * parsing YAML and implementing glob semantics for no gain in evidence
 * quality. A repository with a `package.json` deliberately excluded from
 * its declared workspace globs will be over-reported as a member — a
 * documented scope boundary, not an oversight (see the accompanying task
 * report).
 *
 * A repository with no root `package.json` has no evidence to build a
 * workspace-layout claim from, so no Fact is emitted — absence of evidence
 * is absence of a claim, never a guess (docs/product-specification.md §15).
 */
export async function detectWorkspaceLayoutFacts(
  files: WalkedFile[],
  root: string,
): Promise<Fact[]> {
  const rootPackageJsonFile = files.find((f) => f.path === 'package.json');
  if (!rootPackageJsonFile) return [];

  const rootPackageJson = await readJsonIfExists<RootPackageJsonShape>(
    join(root, rootPackageJsonFile.path),
  );
  if (!rootPackageJson) return [];

  const declaresWorkspaces = hasWorkspacesField(rootPackageJson);
  const pnpmWorkspaceFile = files.find((f) => f.path === 'pnpm-workspace.yaml');

  if (!declaresWorkspaces && !pnpmWorkspaceFile) {
    return [
      {
        category: 'workspace-layout',
        value: ['.'],
        evidence: [
          { path: 'package.json', reason: 'package.json present, declares no "workspaces" field' },
        ],
      },
    ];
  }

  const evidence: Fact['evidence'] = [];
  if (declaresWorkspaces) {
    evidence.push({ path: 'package.json', reason: '"workspaces" field declared' });
  }
  if (pnpmWorkspaceFile) {
    evidence.push({ path: 'pnpm-workspace.yaml', reason: 'pnpm-workspace.yaml present' });
  }

  const memberPaths = files
    .filter((f) => f.path !== 'package.json' && f.path.endsWith('/package.json'))
    .map((f) => f.path.slice(0, -'/package.json'.length))
    .sort((a, b) => a.localeCompare(b));

  for (const memberPath of memberPaths) {
    evidence.push({
      path: `${memberPath}/package.json`,
      reason: 'workspace member package.json present',
    });
  }

  return [
    {
      category: 'workspace-layout',
      value: ['.', ...memberPaths],
      evidence,
    },
  ];
}

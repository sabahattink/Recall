import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { EcosystemMetadata, PackageManager } from '@recall-ai/schemas';
import { readJsonIfExists } from './json.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface RootPackageJson {
  packageManager?: string;
  engines?: { node?: string };
  workspaces?: string[] | { packages?: string[] };
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}

export async function detectEcosystem(root: string): Promise<EcosystemMetadata> {
  const packageJson = await readJsonIfExists<RootPackageJson>(join(root, 'package.json'));

  const [hasPnpmLock, hasNpmLock, hasYarnLock, hasPnpmWorkspaceFile] = await Promise.all([
    exists(join(root, 'pnpm-lock.yaml')),
    exists(join(root, 'package-lock.json')),
    exists(join(root, 'yarn.lock')),
    exists(join(root, 'pnpm-workspace.yaml')),
  ]);

  const packageManager = detectPackageManager(packageJson, {
    hasPnpmLock,
    hasNpmLock,
    hasYarnLock,
  });

  const packageManagerVersion = packageJson?.packageManager
    ? (packageJson.packageManager.split('@')[1] ?? null)
    : null;

  const hasLockfile = hasPnpmLock || hasNpmLock || hasYarnLock;
  let lockfilePath: string | null = null;
  if (hasPnpmLock) lockfilePath = 'pnpm-lock.yaml';
  else if (hasYarnLock) lockfilePath = 'yarn.lock';
  else if (hasNpmLock) lockfilePath = 'package-lock.json';

  const workspaceGlobs = await resolveWorkspaceGlobs(root, packageJson, hasPnpmWorkspaceFile);
  const isMonorepo = workspaceGlobs.length > 0;

  const hasTypescript = Boolean(
    (await exists(join(root, 'tsconfig.json'))) ||
    packageJson?.devDependencies?.typescript ||
    packageJson?.dependencies?.typescript,
  );

  return {
    packageManager,
    packageManagerVersion,
    nodeVersionRange: packageJson?.engines?.node ?? null,
    isMonorepo,
    workspaceGlobs,
    hasTypescript,
    hasLockfile,
    lockfilePath,
  };
}

function detectPackageManager(
  packageJson: RootPackageJson | null,
  lockfiles: { hasPnpmLock: boolean; hasNpmLock: boolean; hasYarnLock: boolean },
): PackageManager {
  const declared = packageJson?.packageManager?.split('@')[0];
  if (declared === 'pnpm' || declared === 'npm' || declared === 'yarn') return declared;

  if (lockfiles.hasPnpmLock) return 'pnpm';
  if (lockfiles.hasYarnLock) return 'yarn';
  if (lockfiles.hasNpmLock) return 'npm';
  return 'unknown';
}

async function resolveWorkspaceGlobs(
  root: string,
  packageJson: RootPackageJson | null,
  hasPnpmWorkspaceFile: boolean,
): Promise<string[]> {
  if (hasPnpmWorkspaceFile) {
    try {
      const { parse } = await import('yaml');
      const contents = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8');
      const parsed = parse(contents) as { packages?: string[] } | undefined;
      if (parsed?.packages) return parsed.packages;
    } catch {
      // Malformed pnpm-workspace.yaml; fall through to package.json workspaces.
    }
  }

  if (Array.isArray(packageJson?.workspaces)) return packageJson.workspaces;
  if (packageJson?.workspaces && typeof packageJson.workspaces === 'object') {
    return packageJson.workspaces.packages ?? [];
  }
  return [];
}

import { join } from 'node:path';
import { access, constants as fsConstants } from 'node:fs/promises';
import {
  MEMORY_FILE_NAMES,
  atomicWriteFile,
  computeStaleness,
  readFileIfExists,
  readManifest,
  readSnapshot,
  removeIfExists,
  validateMarkers,
} from '@recall-ai/memory';
import { GitAdapter, isGitInstalled } from '@recall-ai/git';
import {
  recallDirExists,
  recallDirFor,
  recallDirIsSymlink,
  resolveRepositoryRoot,
} from '../paths.js';

export type DoctorStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  id: string;
  label: string;
  status: DoctorStatus;
  detail?: string;
}

export interface DoctorResult {
  root: string;
  checks: DoctorCheck[];
  overallStatus: DoctorStatus;
}

const MINIMUM_SUPPORTED_NODE_MAJOR = 18;

export async function runDoctor(inputPath: string): Promise<DoctorResult> {
  const root = await resolveRepositoryRoot(inputPath);
  const checks: DoctorCheck[] = [];

  checks.push(checkRuntimeVersion());
  checks.push(await checkGitAvailability());
  checks.push(await checkRepositoryAccess(root));

  const initialized = await recallDirExists(root);
  if (!initialized) {
    checks.push({
      id: 'recall-initialized',
      label: 'Recall initialization',
      status: 'fail',
      detail: 'No .recall directory found. Run `recall init` first.',
    });
    return finalize(root, checks);
  }

  const recallDir = recallDirFor(root);

  const symlinkCheck = await checkRecallDirNotSymlink(root);
  checks.push(symlinkCheck);
  if (symlinkCheck.status === 'fail') {
    // Every check below either reads through `.recall` or writes into it;
    // neither is safe to attempt once it's confirmed to be a symlink.
    return finalize(root, checks);
  }

  const permissionCheck = await checkWritePermission(root);
  checks.push(permissionCheck);

  const { manifest, error: manifestError } = await readManifest(root);
  checks.push({
    id: 'manifest-valid',
    label: 'Manifest validity',
    status: manifestError ? 'fail' : manifest ? 'pass' : 'fail',
    detail: manifestError ?? (manifest ? undefined : 'manifest.json is missing'),
  });

  const { snapshot, error: snapshotError } = await readSnapshot(root);
  checks.push({
    id: 'snapshot-valid',
    label: 'Snapshot validity',
    status: snapshotError ? 'fail' : snapshot ? 'pass' : 'fail',
    detail: snapshotError ?? (snapshot ? undefined : 'snapshots/latest.json is missing'),
  });

  checks.push(...(await checkMarkerIntegrity(recallDir)));

  if (snapshot) {
    checks.push(checkBrokenInternalReferences(snapshot));
    checks.push(checkUnsupportedConfiguration(snapshot));
  }

  if (manifest && snapshot) {
    const git = new GitAdapter(root);
    const currentCommit = await git.currentCommit();
    const staleness = computeStaleness({
      snapshotCommit: manifest.snapshot.commit,
      currentCommit,
      changeReport: null,
    });
    checks.push({
      id: 'memory-freshness',
      label: 'Memory freshness',
      status: staleness.stale ? 'warn' : 'pass',
      detail: staleness.stale ? staleness.reasons.join('; ') : undefined,
    });
  }

  return finalize(root, checks);
}

function finalize(root: string, checks: DoctorCheck[]): DoctorResult {
  const overallStatus: DoctorStatus = checks.some((c) => c.status === 'fail')
    ? 'fail'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'pass';
  return { root, checks, overallStatus };
}

function checkRuntimeVersion(): DoctorCheck {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    id: 'runtime-version',
    label: 'Node.js runtime version',
    status: major >= MINIMUM_SUPPORTED_NODE_MAJOR ? 'pass' : 'fail',
    detail: `Running Node.js ${process.versions.node} (Recall targets Node.js ${MINIMUM_SUPPORTED_NODE_MAJOR}+, recommended 22+).`,
  };
}

async function checkGitAvailability(): Promise<DoctorCheck> {
  const available = await isGitInstalled();
  return available
    ? { id: 'git-available', label: 'Git availability', status: 'pass' }
    : {
        id: 'git-available',
        label: 'Git availability',
        status: 'warn',
        detail:
          'The `git` executable was not found. Recall works without Git but with reduced context (no commit/branch metadata).',
      };
}

async function checkRepositoryAccess(root: string): Promise<DoctorCheck> {
  try {
    await access(root, fsConstants.R_OK);
    return { id: 'repository-access', label: 'Repository access', status: 'pass' };
  } catch {
    return {
      id: 'repository-access',
      label: 'Repository access',
      status: 'fail',
      detail: `Cannot read ${root}.`,
    };
  }
}

async function checkRecallDirNotSymlink(root: string): Promise<DoctorCheck> {
  const isSymlink = await recallDirIsSymlink(root);
  return isSymlink
    ? {
        id: 'recall-dir-not-symlink',
        label: '.recall is not a symlink',
        status: 'fail',
        detail: `${recallDirFor(root)} exists but is a symlink; Recall refuses to read or write through it.`,
      }
    : { id: 'recall-dir-not-symlink', label: '.recall is not a symlink', status: 'pass' };
}

async function checkWritePermission(root: string): Promise<DoctorCheck> {
  const probePath = join(recallDirFor(root), '.doctor-write-probe');
  try {
    await atomicWriteFile(probePath, 'probe', { allowedRoot: root });
    await removeIfExists(probePath);
    return { id: 'write-permission', label: 'Write permission for .recall', status: 'pass' };
  } catch (error) {
    return {
      id: 'write-permission',
      label: 'Write permission for .recall',
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkMarkerIntegrity(recallDir: string): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  for (const fileName of Object.values(MEMORY_FILE_NAMES)) {
    const content = await readFileIfExists(join(recallDir, fileName));
    if (content === null) {
      checks.push({
        id: `markers-${fileName}`,
        label: `Marker integrity: ${fileName}`,
        status: 'warn',
        detail: 'File is missing.',
      });
      continue;
    }
    const validation = validateMarkers(content);
    checks.push({
      id: `markers-${fileName}`,
      label: `Marker integrity: ${fileName}`,
      status: validation.valid ? 'pass' : 'fail',
      detail: validation.reason,
    });
  }
  return checks;
}

function checkBrokenInternalReferences(snapshot: {
  files: Array<{ path: string }>;
  workspaces: Array<{ path: string }>;
  internalEdges: Array<{ from: string; to: string; kind: string }>;
}): DoctorCheck {
  const filePaths = new Set(snapshot.files.map((f) => f.path));
  const workspacePaths = new Set(snapshot.workspaces.map((w) => w.path));
  const broken = snapshot.internalEdges.filter((edge) => {
    const validTarget =
      edge.kind === 'workspace'
        ? workspacePaths.has(edge.to)
        : filePaths.has(edge.to) || workspacePaths.has(edge.to);
    return !validTarget;
  });

  return {
    id: 'broken-internal-references',
    label: 'Broken internal references',
    status: broken.length === 0 ? 'pass' : 'warn',
    detail:
      broken.length > 0
        ? `${broken.length} internal edge(s) reference a target not present in the snapshot.`
        : undefined,
  };
}

function checkUnsupportedConfiguration(snapshot: {
  ecosystem: { packageManager: string; hasLockfile: boolean };
}): DoctorCheck {
  const unsupported = snapshot.ecosystem.packageManager === 'unknown';
  return {
    id: 'unsupported-configuration',
    label: 'Package manager configuration',
    status: unsupported ? 'warn' : 'pass',
    detail: unsupported
      ? 'Could not determine a package manager from lockfiles or package.json.'
      : undefined,
  };
}

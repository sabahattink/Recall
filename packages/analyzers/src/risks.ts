import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DependencyRecord,
  EcosystemMetadata,
  InternalDependencyEdge,
  RiskFinding,
} from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import type { DiscoveredWorkspace } from './workspaces.js';

const LARGE_FILE_THRESHOLD_BYTES = 100 * 1024;
const DEEP_COUPLING_THRESHOLD = 5;
const MIN_SUPPORTED_NODE_MAJOR = 18;

export interface RiskContext {
  root: string;
  files: WalkedFile[];
  workspaces: DiscoveredWorkspace[];
  internalEdges: InternalDependencyEdge[];
  ecosystem: EcosystemMetadata;
  dependencies: DependencyRecord[];
  dockerFiles: string[];
  testFileCount: number;
  gitTrackedFiles: string[] | null;
}

export async function detectRisks(context: RiskContext): Promise<RiskFinding[]> {
  const findings: RiskFinding[] = [];

  findings.push(...detectMissingTests(context));
  findings.push(...detectCircularDependencies(context));
  findings.push(...detectLargeFiles(context));
  findings.push(...detectDeepCoupling(context));
  findings.push(...detectCommittedEnvFiles(context));
  findings.push(...detectUnsupportedRuntime(context));
  findings.push(...detectDuplicateDependencyVersions(context));
  findings.push(...detectMissingLockfile(context));
  findings.push(...(await detectUnpinnedDockerImages(context)));
  findings.push(...detectSuspiciousGeneratedFileTracking(context));

  return findings;
}

function detectMissingTests(context: RiskContext): RiskFinding[] {
  const hasSourceFiles = context.files.some((f) => /\.[jt]sx?$/.test(f.path));
  if (hasSourceFiles && context.testFileCount === 0) {
    return [
      {
        category: 'missing-tests',
        severity: 'high',
        description: 'No test files were found in the repository.',
        evidence: [{ path: '.', reason: 'no file matched common test naming patterns' }],
      },
    ];
  }
  return [];
}

function detectCircularDependencies(context: RiskContext): RiskFinding[] {
  const workspaceEdges = context.internalEdges.filter((e) => e.kind === 'workspace');
  const graph = new Map<string, string[]>();
  for (const edge of workspaceEdges) {
    const list = graph.get(edge.from) ?? [];
    list.push(edge.to);
    graph.set(edge.from, list);
  }

  const findings: RiskFinding[] = [];
  const seenCycles = new Set<string>();

  const visit = (node: string, stack: string[], visited: Set<string>): void => {
    if (stack.includes(node)) {
      const cycle = [...stack.slice(stack.indexOf(node)), node];
      const key = [...new Set(cycle)].sort().join(',');
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        findings.push({
          category: 'circular-dependency',
          severity: 'medium',
          description: `Circular workspace dependency detected: ${cycle.join(' -> ')}.`,
          evidence: cycle.slice(0, -1).map((from, i) => ({
            path: join(from, 'package.json').split('\\').join('/'),
            reason: `depends on "${cycle[i + 1]}"`,
          })),
        });
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    for (const next of graph.get(node) ?? []) {
      visit(next, [...stack, node], visited);
    }
  };

  const visited = new Set<string>();
  for (const node of graph.keys()) {
    visit(node, [], visited);
  }

  return findings;
}

function detectLargeFiles(context: RiskContext): RiskFinding[] {
  return context.files
    .filter((f) => f.sizeBytes > LARGE_FILE_THRESHOLD_BYTES && /\.[jt]sx?$/.test(f.path))
    .map((f) => ({
      category: 'large-file' as const,
      severity: 'low' as const,
      description: `${f.path} is ${Math.round(f.sizeBytes / 1024)} KB, which is unusually large for a single source file.`,
      evidence: [
        {
          path: f.path,
          reason: `file size ${f.sizeBytes} bytes exceeds ${LARGE_FILE_THRESHOLD_BYTES} byte threshold`,
        },
      ],
    }));
}

function detectDeepCoupling(context: RiskContext): RiskFinding[] {
  return context.workspaces
    .filter((w) => w.info.dependsOn.length >= DEEP_COUPLING_THRESHOLD)
    .map((w) => ({
      category: 'deep-coupling' as const,
      severity: 'medium' as const,
      description: `Workspace "${w.info.name}" depends on ${w.info.dependsOn.length} other internal packages, which may indicate deep coupling.`,
      evidence: [
        {
          path: join(w.info.path, 'package.json').split('\\').join('/'),
          reason: `depends on: ${w.info.dependsOn.join(', ')}`,
        },
      ],
    }));
}

function detectCommittedEnvFiles(context: RiskContext): RiskFinding[] {
  const envFiles = context.files.filter((f) => {
    const name = f.path.split('/').pop() ?? '';
    return /^\.env(\..+)?$/.test(name) && !name.endsWith('.example') && !name.endsWith('.sample');
  });
  return envFiles.map((f) => ({
    category: 'committed-env-file' as const,
    severity: 'critical' as const,
    description: `${f.path} looks like an environment file and is not excluded by .gitignore. Its contents are not read or printed by Recall.`,
    evidence: [{ path: f.path, reason: 'file name matches .env pattern and was not ignored' }],
  }));
}

function detectUnsupportedRuntime(context: RiskContext): RiskFinding[] {
  const range = context.ecosystem.nodeVersionRange;
  if (!range) return [];
  const match = range.match(/(\d+)/);
  if (!match) return [];
  const major = Number(match[1]);
  if (major < MIN_SUPPORTED_NODE_MAJOR) {
    return [
      {
        category: 'unsupported-runtime',
        severity: 'medium',
        description: `Declared Node.js engine range "${range}" targets a version older than the widely supported LTS baseline (${MIN_SUPPORTED_NODE_MAJOR}+).`,
        evidence: [{ path: 'package.json', reason: `engines.node = "${range}"` }],
      },
    ];
  }
  return [];
}

function detectDuplicateDependencyVersions(context: RiskContext): RiskFinding[] {
  const versionsByName = new Map<string, Set<string>>();
  for (const dep of context.dependencies) {
    const set = versionsByName.get(dep.name) ?? new Set<string>();
    set.add(dep.version);
    versionsByName.set(dep.name, set);
  }

  const findings: RiskFinding[] = [];
  for (const [name, versions] of versionsByName) {
    if (versions.size > 1) {
      const relevant = context.dependencies.filter((d) => d.name === name);
      findings.push({
        category: 'duplicate-dependency-version',
        severity: 'low',
        description: `Dependency "${name}" is declared with ${versions.size} different version ranges across the repository: ${[...versions].sort().join(', ')}.`,
        evidence: relevant.map((d) => ({
          path: d.workspace
            ? join(d.workspace, 'package.json').split('\\').join('/')
            : 'package.json',
          reason: `declares "${name}": "${d.version}"`,
        })),
      });
    }
  }
  return findings;
}

function detectMissingLockfile(context: RiskContext): RiskFinding[] {
  if (!context.ecosystem.hasLockfile) {
    return [
      {
        category: 'missing-lockfile',
        severity: 'medium',
        description: 'No lockfile (pnpm-lock.yaml, package-lock.json, or yarn.lock) was found.',
        evidence: [{ path: '.', reason: 'no known lockfile present at repository root' }],
      },
    ];
  }
  return [];
}

async function detectUnpinnedDockerImages(context: RiskContext): Promise<RiskFinding[]> {
  const findings: RiskFinding[] = [];
  for (const dockerFile of context.dockerFiles) {
    let contents: string;
    try {
      contents = await readFile(join(context.root, dockerFile), 'utf8');
    } catch {
      continue;
    }
    const lines = contents.split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^\s*FROM\s+([^\s]+)/i);
      if (!match) return;
      const image = match[1] ?? '';
      const hasTag = image.includes('@sha256:') || /:[^/]+$/.test(image);
      if (!hasTag || image.endsWith(':latest')) {
        findings.push({
          category: 'unpinned-docker-image',
          severity: 'medium',
          description: `${dockerFile} uses an unpinned or "latest" base image: "${image}".`,
          evidence: [{ path: dockerFile, line: index + 1, reason: `FROM ${image}` }],
        });
      }
    });
  }
  return findings;
}

const GENERATED_DIR_PATTERN = /(^|\/)(dist|build|coverage|\.next|out)\//;

function detectSuspiciousGeneratedFileTracking(context: RiskContext): RiskFinding[] {
  if (!context.gitTrackedFiles) return [];
  const suspicious = context.gitTrackedFiles.filter((path) => GENERATED_DIR_PATTERN.test(path));
  if (suspicious.length === 0) return [];
  return [
    {
      category: 'suspicious-generated-file-tracking',
      severity: 'low',
      description: `${suspicious.length} file(s) inside typically generated directories (dist/, build/, coverage/, .next/, out/) are tracked by Git.`,
      evidence: suspicious.slice(0, 10).map((path) => ({
        path,
        reason: 'tracked by git despite living in a conventionally generated directory',
      })),
    },
  ];
}

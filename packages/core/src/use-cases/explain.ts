import { relative, resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { readSnapshot } from '@recall-ai/memory';
import type { Confidence, Evidence, FileRecord, InternalDependencyEdge } from '@recall-ai/schemas';
import { InvalidStateError, InvalidUsageError } from '../errors.js';
import { recallDirFor, resolveRepositoryRoot } from '../paths.js';

export interface ExplainResult {
  path: string;
  type: 'file' | 'directory';
  likelyResponsibility: string;
  owningWorkspace: string | null;
  incomingDependencies: InternalDependencyEdge[];
  outgoingDependencies: InternalDependencyEdge[];
  relatedTests: string[];
  relevantConfiguration: string[];
  relevantScripts: Array<{ workspace: string; name: string; command: string }>;
  confidence: Confidence;
  evidence: Evidence[];
  unknowns: string[];
}

const RESPONSIBILITY_PATTERNS: Array<{ test: RegExp; describe: (name: string) => string }> = [
  {
    test: /\.controller\.[jt]s$/,
    describe: (n) =>
      `Handles HTTP routing/request logic for "${n}" (NestJS controller convention).`,
  },
  {
    test: /\.service\.[jt]s$/,
    describe: (n) => `Implements business logic for "${n}" (NestJS service convention).`,
  },
  {
    test: /\.module\.[jt]s$/,
    describe: (n) =>
      `Declares the dependency-injection module wiring for "${n}" (NestJS module convention).`,
  },
  {
    test: /\.repository\.[jt]s$/,
    describe: (n) => `Encapsulates data access for "${n}" (repository convention).`,
  },
  {
    test: /\.guard\.[jt]s$/,
    describe: (n) => `Implements an authorization/route guard named "${n}".`,
  },
  {
    test: /\.pipe\.[jt]s$/,
    describe: (n) => `Implements input transformation/validation named "${n}".`,
  },
  { test: /\.filter\.[jt]s$/, describe: (n) => `Implements exception handling named "${n}".` },
  { test: /\.dto\.[jt]s$/, describe: (n) => `Defines a data-transfer object shape for "${n}".` },
  { test: /\.entity\.[jt]s$/, describe: (n) => `Defines a persisted data model for "${n}".` },
  {
    test: /\.(processor|worker|consumer)\.[jt]s$/,
    describe: (n) => `Processes background jobs/messages for "${n}".`,
  },
  { test: /\.(handler|listener)\.[jt]s$/, describe: (n) => `Handles an event named "${n}".` },
  {
    test: /(^|\/)route\.[jt]s$/,
    describe: () => 'Defines a Next.js route handler (App Router convention).',
  },
  {
    test: /(^|\/)page\.[jt]sx?$/,
    describe: () => 'Defines a Next.js page (App/Pages Router convention).',
  },
  {
    test: /(^|\/)layout\.[jt]sx?$/,
    describe: () => 'Defines a Next.js layout shared across nested routes.',
  },
  {
    test: /(^|\/)main\.[jt]s$/,
    describe: () => 'Bootstraps the application (framework entry-point convention).',
  },
];

export async function runExplain(inputPath: string, targetPath: string): Promise<ExplainResult> {
  const root = await resolveRepositoryRoot(inputPath);
  const { snapshot, error } = await readSnapshot(recallDirFor(root));
  if (!snapshot) {
    throw new InvalidStateError(
      error
        ? `Recall snapshot is corrupted: ${error}. Run \`recall init --force\` or \`recall scan\` to rebuild it.`
        : 'No Recall snapshot found. Run `recall init` or `recall scan` first.',
    );
  }

  const absoluteTarget = resolve(root, targetPath);
  let stats;
  try {
    stats = await stat(absoluteTarget);
  } catch {
    throw new InvalidUsageError(`Path does not exist: ${targetPath}`);
  }

  const relativeTarget = relative(root, absoluteTarget).split('\\').join('/');
  const type: 'file' | 'directory' = stats.isDirectory() ? 'directory' : 'file';

  const matchedFiles: FileRecord[] =
    type === 'file'
      ? snapshot.files.filter((f) => f.path === relativeTarget)
      : snapshot.files.filter(
          (f) => f.path === relativeTarget || f.path.startsWith(`${relativeTarget}/`),
        );

  const owningWorkspace =
    type === 'file'
      ? (matchedFiles[0]?.workspace ?? null)
      : (snapshot.workspaces.find((w) => w.path === relativeTarget)?.path ??
        matchedFiles[0]?.workspace ??
        null);

  const isSelfOrDescendant = (candidate: string) =>
    candidate === relativeTarget || candidate.startsWith(`${relativeTarget}/`);

  const incomingDependencies = snapshot.internalEdges.filter((e) => isSelfOrDescendant(e.to));
  const outgoingDependencies = snapshot.internalEdges.filter((e) => isSelfOrDescendant(e.from));

  const relatedTests =
    type === 'file'
      ? findRelatedTestsForFile(relativeTarget, snapshot.testing.testFiles)
      : snapshot.testing.testFiles.filter((t) => isSelfOrDescendant(t));

  const relevantConfiguration = snapshot.files
    .filter(
      (f) => f.kind === 'config' && (owningWorkspace ? f.workspace === owningWorkspace : true),
    )
    .map((f) => f.path)
    .slice(0, 10);

  const relevantScripts = owningWorkspace
    ? Object.entries(
        snapshot.workspaces.find((w) => w.path === owningWorkspace)?.scripts ?? {},
      ).map(([name, command]) => ({ workspace: owningWorkspace, name, command }))
    : [];

  const { description, confidence, evidence, unknowns } = describeResponsibility(
    relativeTarget,
    type,
    matchedFiles,
    incomingDependencies,
    outgoingDependencies,
  );

  return {
    path: relativeTarget,
    type,
    likelyResponsibility: description,
    owningWorkspace,
    incomingDependencies,
    outgoingDependencies,
    relatedTests,
    relevantConfiguration,
    relevantScripts,
    confidence,
    evidence,
    unknowns,
  };
}

function findRelatedTestsForFile(path: string, testFiles: string[]): string[] {
  const withoutExt = path.replace(/\.[jt]sx?$/, '');
  return testFiles.filter(
    (t) => t.startsWith(withoutExt) || t.replace(/\.(spec|test)\.[jt]sx?$/, '') === withoutExt,
  );
}

function describeResponsibility(
  path: string,
  type: 'file' | 'directory',
  matchedFiles: FileRecord[],
  incoming: InternalDependencyEdge[],
  outgoing: InternalDependencyEdge[],
): { description: string; confidence: Confidence; evidence: Evidence[]; unknowns: string[] } {
  const name = path.split('/').pop() ?? path;
  const evidence: Evidence[] = [];
  const unknowns: string[] = [];

  if (type === 'file') {
    for (const pattern of RESPONSIBILITY_PATTERNS) {
      if (pattern.test.test(path)) {
        evidence.push({ path, reason: `file name matches convention ${pattern.test.source}` });
        return { description: pattern.describe(name), confidence: 'high', evidence, unknowns };
      }
    }

    if (incoming.length > 0 || outgoing.length > 0) {
      evidence.push(
        ...incoming.slice(0, 3).map((e) => ({ path: e.from, reason: `imports this file/module` })),
        ...outgoing.slice(0, 3).map((e) => ({ path, reason: `imports "${e.to}"` })),
      );
      unknowns.push(
        'No naming convention matched; responsibility inferred only from import relationships.',
      );
      return {
        description: `A ${matchedFiles[0]?.kind ?? 'source'} file involved in ${incoming.length + outgoing.length} internal dependency relationship(s).`,
        confidence: 'medium',
        evidence,
        unknowns,
      };
    }

    unknowns.push('No naming convention or import evidence was found for this file.');
    return {
      description: 'Responsibility could not be confidently determined from available evidence.',
      confidence: 'low',
      evidence,
      unknowns,
    };
  }

  const categoryCounts = new Map<string, number>();
  for (const file of matchedFiles) {
    for (const pattern of RESPONSIBILITY_PATTERNS) {
      if (pattern.test.test(file.path)) {
        categoryCounts.set(pattern.test.source, (categoryCounts.get(pattern.test.source) ?? 0) + 1);
        evidence.push({
          path: file.path,
          reason: `contains a file matching convention ${pattern.test.source}`,
        });
      }
    }
  }

  if (categoryCounts.size > 0) {
    return {
      description: `A directory of ${matchedFiles.length} file(s) organized around recognizable conventions (see evidence).`,
      confidence: matchedFiles.length >= 3 ? 'high' : 'medium',
      evidence: evidence.slice(0, 8),
      unknowns,
    };
  }

  if (matchedFiles.length > 0) {
    unknowns.push('Files were found but none matched a recognized naming convention.');
    return {
      description: `A directory containing ${matchedFiles.length} file(s) with no strongly recognizable convention.`,
      confidence: 'low',
      evidence,
      unknowns,
    };
  }

  unknowns.push('No files under this path were present in the last snapshot.');
  return {
    description:
      'Responsibility could not be determined: no matching files found in the last snapshot.',
    confidence: 'low',
    evidence,
    unknowns,
  };
}

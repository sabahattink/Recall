import type {
  DependencyRecord,
  FrameworkDetection,
  RepositorySnapshot,
  RiskFinding,
} from '@recall-ai/schemas';
import { detectFeatureCandidates, type FeatureCandidate } from './feature-detection.js';

export interface DependencyChange {
  name: string;
  workspace: string | null;
  scope: DependencyRecord['scope'];
  from: string | null;
  to: string | null;
}

export interface ScriptChange {
  workspace: string;
  script: string;
  from: string | null;
  to: string | null;
}

export interface FrameworkChange {
  name: string;
  workspace: string | null;
  change: 'added' | 'removed';
}

export interface ChangeReport {
  filesAdded: string[];
  filesRemoved: string[];
  filesChanged: string[];
  packagesAdded: string[];
  packagesRemoved: string[];
  dependencyChanges: DependencyChange[];
  scriptChanges: ScriptChange[];
  frameworkChanges: FrameworkChange[];
  architectureRelevantChanges: string[];
  possibleNewFeatures: FeatureCandidate[];
  possibleRemovedFeatures: FeatureCandidate[];
  risksIntroduced: RiskFinding[];
  risksResolved: RiskFinding[];
  hasChanges: boolean;
}

export function diffSnapshots(
  previous: RepositorySnapshot,
  current: RepositorySnapshot,
): ChangeReport {
  const filesAdded = diffKeys(previous.files, current.files, (f) => f.path).added;
  const filesRemoved = diffKeys(previous.files, current.files, (f) => f.path).removed;
  const filesChanged = detectChangedFiles(previous, current);

  const packagesAdded = diffKeys(previous.workspaces, current.workspaces, (w) => w.name).added;
  const packagesRemoved = diffKeys(previous.workspaces, current.workspaces, (w) => w.name).removed;

  const dependencyChanges = detectDependencyChanges(previous.dependencies, current.dependencies);
  const scriptChanges = detectScriptChanges(previous, current);
  const frameworkChanges = detectFrameworkChanges(previous.frameworks, current.frameworks);

  const architectureRelevantChanges = [
    ...packagesAdded.map((name) => `Workspace package added: ${name}`),
    ...packagesRemoved.map((name) => `Workspace package removed: ${name}`),
    ...detectEntryPointChanges(previous, current),
  ];

  const previousFeatures = detectFeatureCandidates(previous.files);
  const currentFeatures = detectFeatureCandidates(current.files);
  const previousFeatureKeys = new Set(previousFeatures.map((f) => `${f.category}:${f.name}`));
  const currentFeatureKeys = new Set(currentFeatures.map((f) => `${f.category}:${f.name}`));

  const possibleNewFeatures = currentFeatures.filter(
    (f) => !previousFeatureKeys.has(`${f.category}:${f.name}`),
  );
  const possibleRemovedFeatures = previousFeatures.filter(
    (f) => !currentFeatureKeys.has(`${f.category}:${f.name}`),
  );

  const previousRiskKeys = new Set(previous.risks.map(riskKey));
  const currentRiskKeys = new Set(current.risks.map(riskKey));
  const risksIntroduced = current.risks.filter((r) => !previousRiskKeys.has(riskKey(r)));
  const risksResolved = previous.risks.filter((r) => !currentRiskKeys.has(riskKey(r)));

  const hasChanges =
    filesAdded.length > 0 ||
    filesRemoved.length > 0 ||
    filesChanged.length > 0 ||
    packagesAdded.length > 0 ||
    packagesRemoved.length > 0 ||
    dependencyChanges.length > 0 ||
    scriptChanges.length > 0 ||
    frameworkChanges.length > 0 ||
    risksIntroduced.length > 0 ||
    risksResolved.length > 0;

  return {
    filesAdded,
    filesRemoved,
    filesChanged,
    packagesAdded,
    packagesRemoved,
    dependencyChanges,
    scriptChanges,
    frameworkChanges,
    architectureRelevantChanges,
    possibleNewFeatures,
    possibleRemovedFeatures,
    risksIntroduced,
    risksResolved,
    hasChanges,
  };
}

function diffKeys<T>(
  previous: T[],
  current: T[],
  keyOf: (item: T) => string,
): { added: string[]; removed: string[] } {
  const previousKeys = new Set(previous.map(keyOf));
  const currentKeys = new Set(current.map(keyOf));
  const added = [...currentKeys].filter((k) => !previousKeys.has(k)).sort();
  const removed = [...previousKeys].filter((k) => !currentKeys.has(k)).sort();
  return { added, removed };
}

function detectChangedFiles(previous: RepositorySnapshot, current: RepositorySnapshot): string[] {
  const previousByPath = new Map(previous.files.map((f) => [f.path, f]));
  const changed: string[] = [];
  for (const file of current.files) {
    const before = previousByPath.get(file.path);
    if (before && before.sizeBytes !== file.sizeBytes) {
      changed.push(file.path);
    }
  }
  return changed.sort();
}

function detectDependencyChanges(
  previous: DependencyRecord[],
  current: DependencyRecord[],
): DependencyChange[] {
  const keyOf = (d: DependencyRecord) => `${d.workspace ?? '.'}::${d.scope}::${d.name}`;
  const previousByKey = new Map(previous.map((d) => [keyOf(d), d]));
  const currentByKey = new Map(current.map((d) => [keyOf(d), d]));
  const allKeys = new Set([...previousByKey.keys(), ...currentByKey.keys()]);

  const changes: DependencyChange[] = [];
  for (const key of allKeys) {
    const before = previousByKey.get(key);
    const after = currentByKey.get(key);
    if (before?.version === after?.version) continue;
    const record = after ?? before;
    if (!record) continue;
    changes.push({
      name: record.name,
      workspace: record.workspace,
      scope: record.scope,
      from: before?.version ?? null,
      to: after?.version ?? null,
    });
  }

  return changes.sort((a, b) => a.name.localeCompare(b.name));
}

function detectScriptChanges(
  previous: RepositorySnapshot,
  current: RepositorySnapshot,
): ScriptChange[] {
  const previousByPath = new Map(previous.workspaces.map((w) => [w.path, w]));
  const changes: ScriptChange[] = [];

  for (const workspace of current.workspaces) {
    const before = previousByPath.get(workspace.path);
    const beforeScripts = before?.scripts ?? {};
    const scriptNames = new Set([...Object.keys(beforeScripts), ...Object.keys(workspace.scripts)]);
    for (const script of scriptNames) {
      const from = beforeScripts[script] ?? null;
      const to = workspace.scripts[script] ?? null;
      if (from !== to) {
        changes.push({ workspace: workspace.path, script, from, to });
      }
    }
  }

  return changes.sort(
    (a, b) => a.workspace.localeCompare(b.workspace) || a.script.localeCompare(b.script),
  );
}

function detectFrameworkChanges(
  previous: FrameworkDetection[],
  current: FrameworkDetection[],
): FrameworkChange[] {
  const keyOf = (f: FrameworkDetection) => `${f.workspace ?? '.'}::${f.name}`;
  const previousKeys = new Set(previous.map(keyOf));
  const currentKeys = new Set(current.map(keyOf));

  const changes: FrameworkChange[] = [];
  for (const framework of current) {
    if (!previousKeys.has(keyOf(framework))) {
      changes.push({ name: framework.name, workspace: framework.workspace, change: 'added' });
    }
  }
  for (const framework of previous) {
    if (!currentKeys.has(keyOf(framework))) {
      changes.push({ name: framework.name, workspace: framework.workspace, change: 'removed' });
    }
  }
  return changes;
}

function detectEntryPointChanges(
  previous: RepositorySnapshot,
  current: RepositorySnapshot,
): string[] {
  const previousPaths = new Set(previous.entryPoints.map((e) => e.path));
  const currentPaths = new Set(current.entryPoints.map((e) => e.path));
  const changes: string[] = [];
  for (const entryPoint of current.entryPoints) {
    if (!previousPaths.has(entryPoint.path)) changes.push(`Entry point added: ${entryPoint.path}`);
  }
  for (const entryPoint of previous.entryPoints) {
    if (!currentPaths.has(entryPoint.path)) changes.push(`Entry point removed: ${entryPoint.path}`);
  }
  return changes;
}

function riskKey(risk: RiskFinding): string {
  return `${risk.category}::${risk.description}`;
}

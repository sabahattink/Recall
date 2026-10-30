import {
  compareStrings,
  DependencyScopeSchema,
  DirectoryRoleSchema,
  PROJECT_MEMORY_SCHEMA_VERSION,
  ProjectMemorySchema,
  type Dependency,
  type Directory,
  type EntryPoint,
  type Evidence,
  type FactCategory,
  type FactCollection,
  type FactOf,
  type NamedEntry,
  type ProjectMemory,
  type ProjectMetadata,
  type RepositoryMetadataKey,
  type TracedValue,
} from '@recall-ai/schemas';

function factsOf<C extends FactCategory>(facts: FactCollection, category: C): FactOf<C>[] {
  return facts.filter((fact): fact is FactOf<C> => fact.category === category);
}

/**
 * One entry per distinct name, in first-seen order, with the evidence of
 * every Fact naming it merged. Fact order is the Scanner's documented
 * priority order (e.g. TypeScript before JavaScript), so it is preserved.
 */
function namedEntries(facts: Array<{ value: string; evidence: Evidence[] }>): NamedEntry[] {
  const byName = new Map<string, Evidence[]>();
  for (const fact of facts) {
    byName.set(fact.value, [...(byName.get(fact.value) ?? []), ...fact.evidence]);
  }
  return [...byName].map(([name, evidence]) => ({ name, evidence }));
}

const METADATA_KEYS: Record<keyof ProjectMetadata, RepositoryMetadataKey> = {
  name: 'name',
  description: 'description',
  commit: 'commit',
  defaultBranch: 'default-branch',
  remoteUrl: 'remote-url',
};

function normalizeMetadata(facts: FactCollection): ProjectMetadata {
  const metadataFacts = factsOf(facts, 'repository-metadata');
  const traced = (key: RepositoryMetadataKey): TracedValue | null => {
    const fact = metadataFacts.find((f) => f.value.key === key);
    return fact ? { value: fact.value.value, evidence: fact.evidence } : null;
  };
  return {
    name: traced(METADATA_KEYS.name),
    description: traced(METADATA_KEYS.description),
    commit: traced(METADATA_KEYS.commit),
    defaultBranch: traced(METADATA_KEYS.defaultBranch),
    remoteUrl: traced(METADATA_KEYS.remoteUrl),
  };
}

function normalizeLayout(facts: FactCollection): ProjectMemory['architecture']['layout'] {
  const [layout] = factsOf(facts, 'workspace-layout');
  if (!layout) return null;
  return {
    kind: layout.value.length > 1 ? 'monorepo' : 'single-package',
    workspaces: layout.value,
    evidence: layout.evidence,
  };
}

function normalizeEntryPoints(facts: FactCollection): EntryPoint[] {
  return factsOf(facts, 'architecture-hint')
    .map((fact) => ({ ...fact.value, evidence: fact.evidence }))
    .sort((a, b) => compareStrings(a.path, b.path) || compareStrings(a.kind, b.kind));
}

/** Directory facts are one per (path, role); memory holds one entry per path with all its roles. */
function normalizeDirectories(facts: FactCollection): Directory[] {
  const roleOrder = DirectoryRoleSchema.options;
  const byPath = new Map<string, FactOf<'directory'>[]>();
  for (const fact of factsOf(facts, 'directory')) {
    byPath.set(fact.value.path, [...(byPath.get(fact.value.path) ?? []), fact]);
  }

  return [...byPath.keys()].sort(compareStrings).map((path) => {
    const pathFacts = [...(byPath.get(path) ?? [])].sort(
      (a, b) => roleOrder.indexOf(a.value.role) - roleOrder.indexOf(b.value.role),
    );
    return {
      path,
      roles: [...new Set(pathFacts.map((f) => f.value.role))],
      evidence: pathFacts.flatMap((f) => f.evidence),
    };
  });
}

function normalizeDependencies(facts: FactCollection): Dependency[] {
  const scopeOrder = DependencyScopeSchema.options;
  return factsOf(facts, 'dependency')
    .map((fact) => ({
      ...fact.value,
      // The Scanner cites the declaring manifest as the first evidence entry.
      manifest: fact.evidence[0]?.path ?? '.',
      evidence: fact.evidence,
    }))
    .sort(
      (a, b) =>
        compareStrings(a.manifest, b.manifest) ||
        scopeOrder.indexOf(a.scope) - scopeOrder.indexOf(b.scope) ||
        compareStrings(a.name, b.name),
    );
}

/**
 * Normalizes a Scanner Fact collection into Project Memory
 * (docs/product-specification.md §16; MEM-02).
 *
 * A pure function: no I/O, no clock, no randomness, so identical Facts
 * always produce an identical ProjectMemory. Every populated field is
 * built from one or more input Facts and carries their evidence forward;
 * a category with no Facts is empty (`[]`) or `null`, never filled with a
 * default (spec §15: absence of evidence is absence of a claim).
 *
 * Lists with an inherent priority (languages, frameworks, tools, commands,
 * risks) keep the Scanner's documented order; lists without one
 * (directories, entry points, dependencies) are sorted, so the result does
 * not depend on which detector happened to report first.
 *
 * The result is parsed through `ProjectMemorySchema`, which both validates
 * it and rebuilds every object in schema key order.
 */
export function normalizeFacts(facts: FactCollection): ProjectMemory {
  const memory: ProjectMemory = {
    schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
    metadata: normalizeMetadata(facts),
    stack: {
      languages: namedEntries(factsOf(facts, 'language')),
      frameworks: namedEntries(factsOf(facts, 'framework')),
      packageManagers: namedEntries(factsOf(facts, 'package-manager')),
    },
    architecture: {
      layout: normalizeLayout(facts),
      entryPoints: normalizeEntryPoints(facts),
    },
    structure: { directories: normalizeDirectories(facts) },
    commands: factsOf(facts, 'command').map((fact) => ({ ...fact.value, evidence: fact.evidence })),
    conventions: {
      testing: namedEntries(factsOf(facts, 'testing-framework')),
      linting: namedEntries(factsOf(facts, 'linting')),
    },
    dependencies: normalizeDependencies(facts),
    risks: factsOf(facts, 'risk-indicator').map((fact) => ({
      ...fact.value,
      evidence: fact.evidence,
    })),
  };
  return ProjectMemorySchema.parse(memory);
}

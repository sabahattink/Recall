import { z } from 'zod';
import { EvidenceSchema } from './common.js';

/**
 * Exactly the twelve fact categories the Scanner is responsible for
 * surfacing (docs/product-specification.md §15). This list may not grow or
 * shrink without a revision of that specification.
 */
export const FactCategorySchema = z.enum([
  'language',
  'framework',
  'package-manager',
  'workspace-layout',
  'directory',
  'command',
  'testing-framework',
  'linting',
  'architecture-hint',
  'dependency',
  'repository-metadata',
  'risk-indicator',
]);
export type FactCategory = z.infer<typeof FactCategorySchema>;

/** The role a top-level directory plays, evidenced by the files inside it. */
export const DirectoryRoleSchema = z.enum([
  'source',
  'test',
  'config',
  'documentation',
  'generated',
]);
export type DirectoryRole = z.infer<typeof DirectoryRoleSchema>;

export const DirectoryFactValueSchema = z.object({
  path: z.string().min(1),
  role: DirectoryRoleSchema,
});

export const CommandFactValueSchema = z.object({
  /** The manifest script name, e.g. "test". */
  name: z.string().min(1),
  /** The script body exactly as declared, e.g. "vitest run". */
  command: z.string(),
});

export const EntryPointKindSchema = z.enum(['bin', 'main']);
export type EntryPointKind = z.infer<typeof EntryPointKindSchema>;

export const ArchitectureHintFactValueSchema = z.object({
  path: z.string().min(1),
  kind: EntryPointKindSchema,
  /** Directory of the declaring manifest, or `null` for the repository root. */
  workspace: z.string().nullable(),
});

export const DependencyScopeSchema = z.enum(['dependency', 'devDependency', 'peerDependency']);
export type DependencyScope = z.infer<typeof DependencyScopeSchema>;

export const DependencyFactValueSchema = z.object({
  name: z.string().min(1),
  version: z.string(),
  scope: DependencyScopeSchema,
});

export const RepositoryMetadataKeySchema = z.enum([
  'name',
  'description',
  'commit',
  'default-branch',
  'remote-url',
]);
export type RepositoryMetadataKey = z.infer<typeof RepositoryMetadataKeySchema>;

export const RepositoryMetadataFactValueSchema = z.object({
  key: RepositoryMetadataKeySchema,
  value: z.string().min(1),
});

export const RiskIndicatorFactValueSchema = z.object({
  /** Stable kebab-case identifier, e.g. "no-ci-configuration". */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(1),
});

const EvidenceListSchema = z.array(EvidenceSchema).min(1);

function factOf<C extends FactCategory, V extends z.ZodTypeAny>(category: C, value: V) {
  return z.object({
    category: z.literal(category),
    value,
    evidence: EvidenceListSchema,
  });
}

/**
 * A single, evidence-based observation about a repository
 * (docs/product-specification.md §6). Each category carries its own value
 * shape, so the boundary between the Scanner (`@recall-ai/analyzers`) and
 * normalization (`@recall-ai/memory`) is checked at runtime rather than
 * trusted. Every Fact MUST cite at least one piece of Evidence — a Fact
 * with no evidence is a guess, and a guess is never a Fact.
 */
export const FactSchema = z.discriminatedUnion('category', [
  factOf('language', z.string().min(1)),
  factOf('framework', z.string().min(1)),
  factOf('package-manager', z.string().min(1)),
  /** Workspace directories, root (`"."`) first, members sorted after it. */
  factOf('workspace-layout', z.array(z.string().min(1)).min(1)),
  factOf('directory', DirectoryFactValueSchema),
  factOf('command', CommandFactValueSchema),
  factOf('testing-framework', z.string().min(1)),
  factOf('linting', z.string().min(1)),
  factOf('architecture-hint', ArchitectureHintFactValueSchema),
  factOf('dependency', DependencyFactValueSchema),
  factOf('repository-metadata', RepositoryMetadataFactValueSchema),
  factOf('risk-indicator', RiskIndicatorFactValueSchema),
]);
export type Fact = z.infer<typeof FactSchema>;

/** The Fact variant for one category, e.g. `FactOf<'command'>`. */
export type FactOf<C extends FactCategory> = Extract<Fact, { category: C }>;

/** The complete output of a single Scanner run. */
export const FactCollectionSchema = z.array(FactSchema);
export type FactCollection = z.infer<typeof FactCollectionSchema>;

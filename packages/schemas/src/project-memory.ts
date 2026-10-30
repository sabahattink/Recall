import { z } from 'zod';
import { EvidenceSchema } from './common.js';
import { DependencyScopeSchema, DirectoryRoleSchema, EntryPointKindSchema } from './fact.js';

/**
 * Version of the `memory.json` format. Not a knowledge category — it
 * identifies the shape of the document so a consumer can tell which
 * contract it is reading (docs/implementation-blueprint.md §4).
 */
export const PROJECT_MEMORY_SCHEMA_VERSION = '1.0.0';

const EvidenceListSchema = z.array(EvidenceSchema).min(1);

/** A single named observation (a language, a framework, a linter...) and why it is claimed. */
export const NamedEntrySchema = z.object({
  name: z.string().min(1),
  evidence: EvidenceListSchema,
});
export type NamedEntry = z.infer<typeof NamedEntrySchema>;

/** A single scalar observation (the project name, the current commit...) and why it is claimed. */
export const TracedValueSchema = z.object({
  value: z.string().min(1),
  evidence: EvidenceListSchema,
});
export type TracedValue = z.infer<typeof TracedValueSchema>;

export const ProjectMetadataSchema = z.object({
  name: TracedValueSchema.nullable(),
  description: TracedValueSchema.nullable(),
  commit: TracedValueSchema.nullable(),
  defaultBranch: TracedValueSchema.nullable(),
  remoteUrl: TracedValueSchema.nullable(),
});
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;

export const TechnologyStackSchema = z.object({
  languages: z.array(NamedEntrySchema),
  frameworks: z.array(NamedEntrySchema),
  packageManagers: z.array(NamedEntrySchema),
});
export type TechnologyStack = z.infer<typeof TechnologyStackSchema>;

export const RepositoryLayoutKindSchema = z.enum(['single-package', 'monorepo']);
export type RepositoryLayoutKind = z.infer<typeof RepositoryLayoutKindSchema>;

export const EntryPointSchema = z.object({
  path: z.string().min(1),
  kind: EntryPointKindSchema,
  workspace: z.string().nullable(),
  evidence: EvidenceListSchema,
});
export type EntryPoint = z.infer<typeof EntryPointSchema>;

export const ArchitectureSchema = z.object({
  /** `null` when the repository has no manifest a layout claim could be built from. */
  layout: z
    .object({
      kind: RepositoryLayoutKindSchema,
      /** Workspace directories, root (`"."`) first. */
      workspaces: z.array(z.string().min(1)).min(1),
      evidence: EvidenceListSchema,
    })
    .nullable(),
  entryPoints: z.array(EntryPointSchema),
});
export type Architecture = z.infer<typeof ArchitectureSchema>;

export const DirectorySchema = z.object({
  path: z.string().min(1),
  roles: z.array(DirectoryRoleSchema).min(1),
  evidence: EvidenceListSchema,
});
export type Directory = z.infer<typeof DirectorySchema>;

export const RepositoryStructureSchema = z.object({
  directories: z.array(DirectorySchema),
});
export type RepositoryStructure = z.infer<typeof RepositoryStructureSchema>;

export const CommandSchema = z.object({
  name: z.string().min(1),
  command: z.string(),
  evidence: EvidenceListSchema,
});
export type Command = z.infer<typeof CommandSchema>;

export const ConventionsSchema = z.object({
  testing: z.array(NamedEntrySchema),
  linting: z.array(NamedEntrySchema),
});
export type Conventions = z.infer<typeof ConventionsSchema>;

export const DependencySchema = z.object({
  name: z.string().min(1),
  version: z.string(),
  scope: DependencyScopeSchema,
  /** Root-relative path of the manifest that declares it, e.g. `apps/api/package.json`. */
  manifest: z.string().min(1),
  evidence: EvidenceListSchema,
});
export type Dependency = z.infer<typeof DependencySchema>;

export const RiskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  evidence: EvidenceListSchema,
});
export type Risk = z.infer<typeof RiskSchema>;

/**
 * Project Memory: the normalized, agent-independent body of knowledge
 * derived from Facts (docs/product-specification.md §13, §16). Its
 * serialized form is `memory.json`, the single source of truth every agent
 * file is rendered from.
 *
 * The eight knowledge categories are exactly those of spec §16 — no field
 * here refers to any specific Agent. Key order in this object is the key
 * order of `memory.json`: parsing through this schema rebuilds objects in
 * shape order, which is what makes serialization byte-stable.
 */
export const ProjectMemorySchema = z
  .object({
    schemaVersion: z.literal(PROJECT_MEMORY_SCHEMA_VERSION),
    metadata: ProjectMetadataSchema,
    stack: TechnologyStackSchema,
    architecture: ArchitectureSchema,
    structure: RepositoryStructureSchema,
    commands: z.array(CommandSchema),
    conventions: ConventionsSchema,
    dependencies: z.array(DependencySchema),
    risks: z.array(RiskSchema),
  })
  .strict();
export type ProjectMemory = z.infer<typeof ProjectMemorySchema>;

/** The knowledge categories of spec §16, in `memory.json` order. */
export const PROJECT_MEMORY_CATEGORIES = [
  'metadata',
  'stack',
  'architecture',
  'structure',
  'commands',
  'conventions',
  'dependencies',
  'risks',
] as const;

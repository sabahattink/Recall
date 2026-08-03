import { z } from 'zod';
import { ConfidenceSchema, EvidenceSchema, SeveritySchema } from './common.js';
import { GitMetadataSchema } from './git.js';

export const PackageManagerSchema = z.enum(['pnpm', 'npm', 'yarn', 'unknown']);
export type PackageManager = z.infer<typeof PackageManagerSchema>;

export const RepositoryMetadataSchema = z.object({
  name: z.string(),
  root: z.string(),
  description: z.string().nullable(),
});
export type RepositoryMetadata = z.infer<typeof RepositoryMetadataSchema>;

export const EcosystemMetadataSchema = z.object({
  packageManager: PackageManagerSchema,
  packageManagerVersion: z.string().nullable(),
  nodeVersionRange: z.string().nullable(),
  isMonorepo: z.boolean(),
  workspaceGlobs: z.array(z.string()),
  hasTypescript: z.boolean(),
  hasLockfile: z.boolean(),
  lockfilePath: z.string().nullable(),
});
export type EcosystemMetadata = z.infer<typeof EcosystemMetadataSchema>;

export const WorkspaceKindSchema = z.enum(['app', 'package', 'service', 'library', 'root']);
export type WorkspaceKind = z.infer<typeof WorkspaceKindSchema>;

export const WorkspaceInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: WorkspaceKindSchema,
  version: z.string().nullable(),
  private: z.boolean(),
  dependsOn: z.array(z.string()),
  main: z.string().nullable(),
  scripts: z.record(z.string(), z.string()),
});
export type WorkspaceInfo = z.infer<typeof WorkspaceInfoSchema>;

export const FileKindSchema = z.enum([
  'source',
  'test',
  'config',
  'documentation',
  'generated',
  'other',
]);
export type FileKind = z.infer<typeof FileKindSchema>;

export const FileRecordSchema = z.object({
  path: z.string(),
  workspace: z.string().nullable(),
  kind: FileKindSchema,
  sizeBytes: z.number().int().nonnegative(),
  extension: z.string(),
});
export type FileRecord = z.infer<typeof FileRecordSchema>;

export const EntryPointKindSchema = z.enum([
  'bin',
  'main',
  'script',
  'framework-convention',
  'test-runner',
]);
export type EntryPointKind = z.infer<typeof EntryPointKindSchema>;

export const EntryPointSchema = z.object({
  path: z.string(),
  workspace: z.string().nullable(),
  kind: EntryPointKindSchema,
  evidence: z.array(EvidenceSchema),
});
export type EntryPoint = z.infer<typeof EntryPointSchema>;

export const DependencyScopeSchema = z.enum(['dependency', 'devDependency', 'peerDependency']);
export type DependencyScope = z.infer<typeof DependencyScopeSchema>;

export const DependencyRecordSchema = z.object({
  name: z.string(),
  version: z.string(),
  scope: DependencyScopeSchema,
  workspace: z.string().nullable(),
});
export type DependencyRecord = z.infer<typeof DependencyRecordSchema>;

export const InternalDependencyEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(['workspace', 'import']),
  evidence: z.array(EvidenceSchema),
});
export type InternalDependencyEdge = z.infer<typeof InternalDependencyEdgeSchema>;

export const FrameworkNameSchema = z.enum([
  'nestjs',
  'nextjs',
  'react',
  'express',
  'fastify',
  'vue',
  'generic-node',
]);
export type FrameworkName = z.infer<typeof FrameworkNameSchema>;

export const FrameworkDetectionSchema = z.object({
  name: FrameworkNameSchema,
  workspace: z.string().nullable(),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type FrameworkDetection = z.infer<typeof FrameworkDetectionSchema>;

export const ConventionCategorySchema = z.enum([
  'file-naming',
  'directory-naming',
  'import-alias',
  'test-naming',
  'linting',
  'formatting',
  'package-scripts',
  'module-organization',
  'error-handling',
]);
export type ConventionCategory = z.infer<typeof ConventionCategorySchema>;

export const ConventionFindingSchema = z.object({
  category: ConventionCategorySchema,
  description: z.string(),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema),
});
export type ConventionFinding = z.infer<typeof ConventionFindingSchema>;

export const RiskCategorySchema = z.enum([
  'missing-tests',
  'circular-dependency',
  'large-file',
  'deep-coupling',
  'committed-env-file',
  'unsupported-runtime',
  'duplicate-dependency-version',
  'missing-lockfile',
  'unpinned-docker-image',
  'suspicious-generated-file-tracking',
]);
export type RiskCategory = z.infer<typeof RiskCategorySchema>;

export const RiskFindingSchema = z.object({
  category: RiskCategorySchema,
  severity: SeveritySchema,
  description: z.string(),
  evidence: z.array(EvidenceSchema),
});
export type RiskFinding = z.infer<typeof RiskFindingSchema>;

export const CiConfigurationSchema = z.object({
  detected: z.boolean(),
  providers: z.array(z.string()),
  configFiles: z.array(z.string()),
});
export type CiConfiguration = z.infer<typeof CiConfigurationSchema>;

export const DockerConfigurationSchema = z.object({
  detected: z.boolean(),
  files: z.array(z.string()),
});
export type DockerConfiguration = z.infer<typeof DockerConfigurationSchema>;

export const TestingInfoSchema = z.object({
  frameworks: z.array(z.string()),
  testFiles: z.array(z.string()),
});
export type TestingInfo = z.infer<typeof TestingInfoSchema>;

export const ServiceIntegrationCategorySchema = z.enum([
  'database',
  'queue',
  'cache',
  'authentication',
  'external-service',
]);
export type ServiceIntegrationCategory = z.infer<typeof ServiceIntegrationCategorySchema>;

export const ServiceIntegrationSchema = z.object({
  category: ServiceIntegrationCategorySchema,
  name: z.string(),
  evidence: z.array(EvidenceSchema),
});
export type ServiceIntegration = z.infer<typeof ServiceIntegrationSchema>;

export const RepositorySnapshotSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  repository: RepositoryMetadataSchema,
  git: GitMetadataSchema.nullable(),
  ecosystem: EcosystemMetadataSchema,
  workspaces: z.array(WorkspaceInfoSchema),
  files: z.array(FileRecordSchema),
  entryPoints: z.array(EntryPointSchema),
  dependencies: z.array(DependencyRecordSchema),
  internalEdges: z.array(InternalDependencyEdgeSchema),
  frameworks: z.array(FrameworkDetectionSchema),
  conventions: z.array(ConventionFindingSchema),
  risks: z.array(RiskFindingSchema),
  testing: TestingInfoSchema,
  ci: CiConfigurationSchema,
  docker: DockerConfigurationSchema,
  serviceIntegrations: z.array(ServiceIntegrationSchema),
  generatedFiles: z.array(z.string()),
  ignoredDirectories: z.array(z.string()),
  generatedAt: z.string(),
});
export type RepositorySnapshot = z.infer<typeof RepositorySnapshotSchema>;

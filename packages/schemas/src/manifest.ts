import { z } from 'zod';

export const CURRENT_MANIFEST_SCHEMA_VERSION = '1.0.0';

export const ManifestFilesSchema = z.object({
  architecture: z.string(),
  conventions: z.string(),
  decisions: z.string(),
  features: z.string(),
  glossary: z.string(),
  risks: z.string(),
  technicalDebt: z.string(),
});
export type ManifestFiles = z.infer<typeof ManifestFilesSchema>;

export const ManifestSnapshotRefSchema = z.object({
  commit: z.string().nullable(),
  branch: z.string().nullable(),
  path: z.string(),
});
export type ManifestSnapshotRef = z.infer<typeof ManifestSnapshotRefSchema>;

export const ManifestRepositorySchema = z.object({
  name: z.string(),
  root: z.string(),
  defaultBranch: z.string().nullable(),
});
export type ManifestRepository = z.infer<typeof ManifestRepositorySchema>;

export const ManifestSchema = z.object({
  $schema: z.string(),
  schemaVersion: z.literal(CURRENT_MANIFEST_SCHEMA_VERSION),
  toolVersion: z.string(),
  repository: ManifestRepositorySchema,
  generatedAt: z.string(),
  updatedAt: z.string(),
  snapshot: ManifestSnapshotRefSchema,
  files: ManifestFilesSchema,
});
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * A migration upgrades a manifest produced by an older schemaVersion to the next
 * version. Migrations are chained by the schema registry so a manifest from any
 * historical version can be brought forward without hand-written upgrade paths
 * scattered through the codebase.
 */
export interface ManifestMigration {
  readonly fromVersion: string;
  readonly toVersion: string;
  migrate(input: Record<string, unknown>): Record<string, unknown>;
}

export function runManifestMigrations(
  input: Record<string, unknown>,
  migrations: ManifestMigration[],
): Record<string, unknown> {
  let current = input;
  let currentVersion = String(current.schemaVersion ?? '');
  let progressed = true;
  while (currentVersion !== CURRENT_MANIFEST_SCHEMA_VERSION && progressed) {
    progressed = false;
    for (const migration of migrations) {
      if (migration.fromVersion === currentVersion) {
        current = migration.migrate(current);
        currentVersion = migration.toVersion;
        progressed = true;
        break;
      }
    }
  }
  return current;
}

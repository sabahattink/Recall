import { z } from 'zod';

/**
 * Read-only Git metadata the Scanner may attach to a repository. Every
 * field is independently nullable: a repository with no commits, no
 * `origin` remote, or no resolvable remote HEAD simply omits that field.
 *
 * Deliberately excludes anything that changes as a side effect of running
 * Recall itself (working-tree dirtiness, untracked files) — `.recall/`
 * appearing on disk must never change the next run's output (spec §20,
 * Idempotency).
 */
export const GitMetadataSchema = z.object({
  commit: z.string().nullable(),
  defaultBranch: z.string().nullable(),
  remoteUrl: z.string().nullable(),
});
export type GitMetadata = z.infer<typeof GitMetadataSchema>;

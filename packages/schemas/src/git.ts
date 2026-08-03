import { z } from 'zod';

export const GitMetadataSchema = z.object({
  isRepository: z.literal(true),
  branch: z.string().nullable(),
  commit: z.string().nullable(),
  isDirty: z.boolean(),
  remoteUrl: z.string().nullable(),
  defaultBranch: z.string().nullable(),
  changedFiles: z.array(z.string()),
});
export type GitMetadata = z.infer<typeof GitMetadataSchema>;

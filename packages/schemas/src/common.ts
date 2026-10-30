import { z } from 'zod';

/**
 * A pointer to the concrete thing in the repository that justifies a claim:
 * a root-relative, forward-slash path plus a short human-readable reason.
 */
export const EvidenceSchema = z.object({
  path: z.string(),
  line: z.number().int().positive().optional(),
  reason: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

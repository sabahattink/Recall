import { z } from 'zod';

/**
 * Confidence reflects how strongly deterministic evidence supports a finding.
 * Recall never claims certainty it cannot support with evidence.
 */
export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const EvidenceSchema = z.object({
  path: z.string(),
  line: z.number().int().positive().optional(),
  reason: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

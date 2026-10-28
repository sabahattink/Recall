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

/**
 * A single, evidence-based observation about a repository
 * (docs/product-specification.md §6). `value` is intentionally
 * unconstrained: each category's concrete shape is defined by the detector
 * that produces it, not speculated on here. Every Fact MUST cite at least
 * one piece of Evidence — a Fact with no evidence is a guess, and a guess
 * is never a Fact.
 */
export const FactSchema = z.object({
  category: FactCategorySchema,
  value: z.unknown(),
  evidence: z.array(EvidenceSchema).min(1),
});
export type Fact = z.infer<typeof FactSchema>;

/** The complete output of a single Scanner run. */
export const FactCollectionSchema = z.array(FactSchema);
export type FactCollection = z.infer<typeof FactCollectionSchema>;

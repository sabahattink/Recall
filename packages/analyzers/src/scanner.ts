import { FactCollectionSchema, type FactCollection, type GitMetadata } from '@recall-ai/schemas';
import { walkRepository } from './file-walk.js';
import { DEFAULT_MAX_FILES } from './constants.js';
import { detectRepositoryMetadataFacts } from './repository-metadata-facts.js';
import { detectLanguageFacts, detectPackageManagerFacts } from './language-facts.js';
import { detectFrameworkFacts } from './framework-facts.js';
import { detectWorkspaceLayoutFacts } from './workspace-layout-facts.js';
import { detectArchitectureHintFacts } from './architecture-hint-facts.js';
import { detectCommandAndToolingFacts } from './command-tooling-facts.js';
import { detectDependencyFacts } from './dependency-facts.js';
import { detectRiskIndicatorFacts } from './risk-indicator-facts.js';

export interface ScanOptions {
  /** Read-only Git metadata collected by the caller, or `null` when unavailable. */
  git?: GitMetadata | null;
  maxFiles?: number;
}

/**
 * The Scanner (docs/product-specification.md §15): walks the repository
 * once and runs every detector over that single file list, producing the
 * complete, evidence-backed Fact collection for one repository state.
 *
 * Detectors are independent of each other except risk indicators, which
 * are conditions over the other Facts and therefore run last. Output order
 * is fixed — detector order, then each detector's own documented order —
 * so the same repository always yields the same collection.
 *
 * The result is validated against `FactCollectionSchema` before it is
 * returned: the Fact schema is the contract between this package and
 * normalization, and a detector bug must fail here, loudly, rather than
 * surface later as a malformed `memory.json`.
 */
export async function scanRepository(
  root: string,
  options: ScanOptions = {},
): Promise<FactCollection> {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const { files, truncated } = await walkRepository(root, { maxFiles });

  const [metadata, frameworks, workspaceLayout, architecture, tooling, dependencies] =
    await Promise.all([
      detectRepositoryMetadataFacts(files, root, options.git ?? null),
      detectFrameworkFacts(files, root),
      detectWorkspaceLayoutFacts(files, root),
      detectArchitectureHintFacts(files, root),
      detectCommandAndToolingFacts(files, root),
      detectDependencyFacts(files, root),
    ]);

  const facts: FactCollection = [
    ...metadata,
    ...detectLanguageFacts(files),
    ...detectPackageManagerFacts(files),
    ...frameworks,
    ...workspaceLayout,
    ...architecture,
    ...tooling,
    ...dependencies,
  ];
  const risks = detectRiskIndicatorFacts({ files, facts, truncated, maxFiles });

  return FactCollectionSchema.parse([...facts, ...risks]);
}

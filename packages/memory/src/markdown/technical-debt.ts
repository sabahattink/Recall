import type { RepositorySnapshot } from '@recall-ai/schemas';
import { bulletList, defaultTemplate, evidenceList } from './template.js';

const DEBT_CATEGORIES = new Set([
  'large-file',
  'deep-coupling',
  'duplicate-dependency-version',
  'missing-tests',
  'missing-lockfile',
  'circular-dependency',
]);

export function technicalDebtTemplate(): (section: string) => string {
  return defaultTemplate(
    'Technical Debt',
    'Measurable technical-debt findings drawn from the same deterministic risk rules as risks.md, filtered to categories that typically represent accumulated debt rather than acute risk.',
    'Track debt Recall cannot measure structurally (deferred refactors, known workarounds, deprecated APIs still in use). This section is never modified by Recall.',
  );
}

export function generateTechnicalDebtBody(snapshot: RepositorySnapshot): string {
  const debtFindings = snapshot.risks.filter((r) => DEBT_CATEGORIES.has(r.category));
  if (debtFindings.length === 0) {
    return "_No measurable technical debt was detected by Recall's current rule set._";
  }

  return bulletList(
    debtFindings.map((r) => {
      const ev = evidenceList(r.evidence);
      return `**${r.category}** (severity: ${r.severity}): ${r.description}${ev ? `\n${ev}` : ''}`;
    }),
  );
}

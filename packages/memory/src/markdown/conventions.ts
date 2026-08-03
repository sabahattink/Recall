import type { RepositorySnapshot } from '@recall-ai/schemas';
import { bulletList, defaultTemplate, evidenceList } from './template.js';

export function conventionsTemplate(): (section: string) => string {
  return defaultTemplate(
    'Conventions',
    'Conventions Recall derived from actual project evidence: naming, aliases, linting, and structure. Nothing here is a stylistic recommendation — each entry is backed by evidence in the repository.',
    'Document conventions Recall cannot detect from file structure alone (naming rationale, review norms, non-enforced style rules). This section is never modified by Recall.',
  );
}

export function generateConventionsBody(snapshot: RepositorySnapshot): string {
  if (snapshot.conventions.length === 0) {
    return '_No conventions could be reliably derived from the current repository evidence._';
  }

  const byCategory = new Map<string, typeof snapshot.conventions>();
  for (const finding of snapshot.conventions) {
    const list = byCategory.get(finding.category) ?? [];
    list.push(finding);
    byCategory.set(finding.category, list);
  }

  const sections: string[] = [];
  for (const [category, findings] of [...byCategory.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    sections.push(`### ${titleCase(category)}\n`);
    sections.push(
      bulletList(
        findings.map((f) => {
          const ev = evidenceList(f.evidence);
          return `${f.description} (confidence: ${f.confidence})${ev ? `\n${ev}` : ''}`;
        }),
      ),
    );
    sections.push('');
  }

  return sections.join('\n').trim();
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

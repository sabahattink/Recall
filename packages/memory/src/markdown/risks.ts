import type { RepositorySnapshot } from '@recall-ai/schemas';
import { bulletList, defaultTemplate, evidenceList } from './template.js';

export function risksTemplate(): (section: string) => string {
  return defaultTemplate(
    'Risks',
    'Evidence-based risk findings from deterministic repository rules (missing tests, circular dependencies, large files, and similar). This is not a security scan and does not replace one — see [SECURITY.md](../SECURITY.md) for how to report vulnerabilities.',
    'Add risks known to the team that Recall cannot detect structurally (operational risks, incident history, planned mitigations). This section is never modified by Recall.',
  );
}

export function generateRisksBody(snapshot: RepositorySnapshot): string {
  if (snapshot.risks.length === 0) {
    return "_No risks were detected by Recall's current rule set._";
  }

  const bySeverity = new Map<string, typeof snapshot.risks>();
  for (const risk of snapshot.risks) {
    const list = bySeverity.get(risk.severity) ?? [];
    list.push(risk);
    bySeverity.set(risk.severity, list);
  }

  const order = ['critical', 'high', 'medium', 'low'];
  const sections: string[] = [];
  for (const severity of order) {
    const risks = bySeverity.get(severity);
    if (!risks || risks.length === 0) continue;
    sections.push(`### ${severity[0]?.toUpperCase()}${severity.slice(1)} severity\n`);
    sections.push(
      bulletList(
        risks.map((r) => {
          const ev = evidenceList(r.evidence);
          return `**${r.category}**: ${r.description}${ev ? `\n${ev}` : ''}`;
        }),
      ),
    );
    sections.push('');
  }

  return sections.join('\n').trim();
}

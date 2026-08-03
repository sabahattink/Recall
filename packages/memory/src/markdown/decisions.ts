import type { RepositorySnapshot } from '@recall-ai/schemas';
import { bulletList, evidenceList } from './template.js';

const ADR_TEMPLATE = `## ADR-0001: Title of the decision

- **Status:** proposed | accepted | superseded
- **Date:** YYYY-MM-DD
- **Context:** What problem or constraint led to this decision?
- **Decision:** What was decided?
- **Consequences:** What becomes easier or harder as a result?

<!-- Copy the block above for each new decision. Recall never edits this section. -->`;

export function decisionsTemplate(): (section: string) => string {
  return (section: string) =>
    `# Decisions\n\nAn Architecture Decision Record (ADR) log for this repository. Recall does not invent architectural decisions — it only surfaces candidates with strong, evidence-backed signals below. Confirmed decisions belong in the human-editable section beneath them.\n\n${section}\n\n## Recorded decisions\n\n${ADR_TEMPLATE}\n`;
}

export function generateDecisionsBody(snapshot: RepositorySnapshot): string {
  const candidates: string[] = [];

  for (const integration of snapshot.serviceIntegrations) {
    const ev = evidenceList(integration.evidence);
    candidates.push(
      `**Unconfirmed candidate:** the repository appears to use ${integration.name} for ${integration.category}.${ev ? `\n${ev}` : ''}`,
    );
  }

  for (const framework of snapshot.frameworks.filter((f) => f.confidence === 'high')) {
    const ev = evidenceList(framework.evidence);
    candidates.push(
      `**Unconfirmed candidate:** ${framework.workspace ? `\`${framework.workspace}\` uses` : 'the repository uses'} ${framework.name} as its primary framework.${ev ? `\n${ev}` : ''}`,
    );
  }

  if (candidates.length === 0) {
    return '_No candidate decisions were derived from the current evidence. Add confirmed decisions to the "Recorded decisions" section below._';
  }

  return bulletList(candidates);
}

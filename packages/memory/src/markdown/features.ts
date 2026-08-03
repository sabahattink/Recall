import type { RepositorySnapshot } from '@recall-ai/schemas';
import { bulletList, defaultTemplate, evidenceList } from './template.js';
import { detectFeatureCandidates } from '../feature-detection.js';

export function featuresTemplate(): (section: string) => string {
  return defaultTemplate(
    'Features',
    'Features Recall could identify from strong structural evidence (controllers, routes, modules, job processors, event handlers, and feature directories). This is not a product feature list — it reflects what the code contains, not what it is for.',
    'Describe what each feature actually does for users, and add features Recall cannot detect from structure alone. This section is never modified by Recall.',
  );
}

export function generateFeaturesBody(snapshot: RepositorySnapshot): string {
  const candidates = detectFeatureCandidates(snapshot.files);
  if (candidates.length === 0) {
    return '_No features could be identified from strong structural evidence in this repository._';
  }

  const byCategory = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const list = byCategory.get(candidate.category) ?? [];
    list.push(candidate);
    byCategory.set(candidate.category, list);
  }

  const sections: string[] = [];
  for (const [category, items] of [...byCategory.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    sections.push(`### ${category}\n`);
    sections.push(
      bulletList(
        items.map((item) => {
          const ev = evidenceList(item.evidence);
          return `${item.name}${ev ? `\n${ev}` : ''}`;
        }),
      ),
    );
    sections.push('');
  }

  return sections.join('\n').trim();
}

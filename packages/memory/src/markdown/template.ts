export function defaultTemplate(
  title: string,
  description: string,
  humanGuidance: string,
): (generatedSection: string) => string {
  return (generatedSection: string) =>
    `# ${title}\n\n${description}\n\n${generatedSection}\n\n## Notes\n\n${humanGuidance}\n`;
}

export function bulletList(items: string[]): string {
  if (items.length === 0) return '_None detected._';
  return items.map((item) => `- ${item}`).join('\n');
}

export function evidenceList(
  evidence: Array<{ path: string; line?: number; reason: string }>,
): string {
  if (evidence.length === 0) return '';
  return evidence
    .slice(0, 8)
    .map((e) => `  - \`${e.path}${e.line ? `:${e.line}` : ''}\` — ${e.reason}`)
    .join('\n');
}

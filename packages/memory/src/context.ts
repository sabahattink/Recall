import type { GitMetadata, RepositorySnapshot } from '@recall-ai/schemas';
import { estimateTokens } from './token-estimate.js';
import { bulletList } from './markdown/template.js';

export interface ContextOptions {
  task?: string;
  maxTokens?: number;
}

export interface ContextResult {
  content: string;
  estimatedTokens: number;
  truncated: boolean;
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'for',
  'in',
  'on',
  'with',
  'is',
  'are',
  'add',
  'implement',
  'create',
  'fix',
  'update',
  'this',
  'that',
]);

function extractKeywords(task: string): string[] {
  return [
    ...new Set(
      task
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
    ),
  ];
}

function pathMatchesKeywords(path: string, keywords: string[]): boolean {
  const lowerPath = path.toLowerCase();
  return keywords.some((keyword) => lowerPath.includes(keyword));
}

/**
 * Generates compact, agent-ready context for the repository, optionally
 * focused on a task. When `maxTokens` is set, list-based sections are
 * shrunk through a fixed sequence of caps (20 → 10 → 5 → 3 → 1 items) until
 * the estimate fits; this keeps truncation deterministic for the same
 * snapshot and options rather than depending on iteration order or timing.
 */
export function generateContext(
  snapshot: RepositorySnapshot,
  options: ContextOptions = {},
): ContextResult {
  const keywords = options.task ? extractKeywords(options.task) : [];
  const caps = [20, 10, 5, 3, 1];

  let content = '';
  let truncated = false;

  for (let i = 0; i < caps.length; i++) {
    content = renderContext(snapshot, options, keywords, caps[i] as number);
    const tokens = estimateTokens(content);
    if (!options.maxTokens || tokens <= options.maxTokens) {
      if (i > 0) truncated = true;
      return { content, estimatedTokens: tokens, truncated };
    }
  }

  // Even the most aggressive cap did not fit; hard-truncate as a last resort.
  const maxChars = (options.maxTokens ?? estimateTokens(content)) * 4;
  const finalContent =
    content.length > maxChars
      ? `${content.slice(0, maxChars)}\n\n_[truncated to fit --max-tokens]_\n`
      : content;
  return { content: finalContent, estimatedTokens: estimateTokens(finalContent), truncated: true };
}

function renderContext(
  snapshot: RepositorySnapshot,
  options: ContextOptions,
  keywords: string[],
  cap: number,
): string {
  const sections: string[] = [];

  sections.push(`# Recall Context: ${snapshot.repository.name}`);
  if (options.task) {
    sections.push(`\n_Generated for task: "${options.task}"_`);
  }

  sections.push('\n## 1. Project summary\n');
  sections.push(
    `- Repository: ${snapshot.repository.name}\n- Package manager: ${snapshot.ecosystem.packageManager}${snapshot.ecosystem.isMonorepo ? ' (monorepo)' : ''}\n- Primary frameworks: ${[...new Set(snapshot.frameworks.map((f) => f.name))].join(', ') || 'none detected'}`,
  );

  sections.push('\n## 2. Repository layout\n');
  sections.push(
    bulletList(
      snapshot.workspaces.slice(0, cap).map((w) => `\`${w.path}\` — ${w.kind} (${w.name})`),
    ),
  );

  sections.push('\n## 3. Architecture\n');
  const workspaceEdges = snapshot.internalEdges.filter((e) => e.kind === 'workspace').slice(0, cap);
  sections.push(bulletList(workspaceEdges.map((e) => `\`${e.from}\` → \`${e.to}\``)));

  sections.push('\n## 4. Important conventions\n');
  sections.push(bulletList(snapshot.conventions.slice(0, cap).map((c) => c.description)));

  sections.push('\n## 5. Primary entry points\n');
  sections.push(
    bulletList(snapshot.entryPoints.slice(0, cap).map((e) => `\`${e.path}\` (${e.kind})`)),
  );

  sections.push('\n## 6. Important commands\n');
  const scripts = [...new Set(snapshot.workspaces.flatMap((w) => Object.keys(w.scripts)))].slice(
    0,
    cap,
  );
  sections.push(
    bulletList(
      scripts.map(
        (s) =>
          `\`${snapshot.ecosystem.packageManager === 'unknown' ? 'npm' : snapshot.ecosystem.packageManager} run ${s}\``,
      ),
    ),
  );

  sections.push('\n## 7. Known risks\n');
  sections.push(
    bulletList(snapshot.risks.slice(0, cap).map((r) => `[${r.severity}] ${r.description}`)),
  );

  sections.push('\n## 8. Technical debt\n');
  const debt = snapshot.risks.filter((r) =>
    ['large-file', 'deep-coupling', 'circular-dependency'].includes(r.category),
  );
  sections.push(bulletList(debt.slice(0, cap).map((r) => r.description)));

  sections.push('\n## 9. Relevant decisions\n');
  sections.push(
    bulletList(
      snapshot.serviceIntegrations
        .slice(0, cap)
        .map((s) => `Unconfirmed: uses ${s.name} for ${s.category}`),
    ),
  );

  const filesToRead = rankFilesForTask(snapshot, keywords, cap);
  sections.push('\n## 10. Files an agent should read first\n');
  sections.push(bulletList(filesToRead));

  sections.push('\n## 11. Files and directories an agent should avoid modifying\n');
  sections.push(
    bulletList([
      '`.recall/` — Recall-managed memory; edit only the human sections outside the generated markers',
      ...snapshot.generatedFiles.slice(0, cap),
    ]),
  );

  sections.push('\n## 12. Current Git state\n');
  sections.push(bulletList(gitStateLines(snapshot.git)));

  return sections.join('\n');
}

function rankFilesForTask(snapshot: RepositorySnapshot, keywords: string[], cap: number): string[] {
  const sourceFiles = snapshot.files.filter((f) => f.kind === 'source');
  if (keywords.length === 0) {
    return snapshot.entryPoints.slice(0, cap).map((e) => e.path);
  }
  const matches = sourceFiles
    .filter((f) => pathMatchesKeywords(f.path, keywords))
    .map((f) => f.path);
  if (matches.length === 0) {
    return snapshot.entryPoints.slice(0, cap).map((e) => e.path);
  }
  return matches.slice(0, cap);
}

function gitStateLines(git: GitMetadata | null): string[] {
  if (!git) return ['Not a Git repository.'];
  return [
    `Branch: ${git.branch ?? 'unknown'}`,
    `Commit: ${git.commit ?? 'unknown'}`,
    `Working tree: ${git.isDirty ? 'has uncommitted changes' : 'clean'}`,
  ];
}

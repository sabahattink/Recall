import type { GitMetadata, RepositorySnapshot } from '@recall-ai/schemas';
import { estimateTokens } from './token-estimate.js';
import { bulletList } from './markdown/template.js';
import { rankFilesForTask, type RankedFile, type RankingReason } from './task-ranking.js';

export interface ContextOptions {
  task?: string;
  maxTokens?: number;
}

export interface ContextResult {
  content: string;
  estimatedTokens: number;
  truncated: boolean;
  /** The task text this context was generated for, or null for the default (non-task) context. */
  task: string | null;
  /**
   * Full ranking output (path, score, reasons) for every file that scored
   * above zero, in ranked order — not just the ones shown in the Markdown
   * list. Empty when no task was given. This is what `--json` output
   * exposes for explainability; the Markdown itself never shows raw scores.
   */
  rankedFiles: RankedFile[];
}

/** Default number of files shown under "Files an agent should read first" — kept in the 8-12 range the sprint calls for. */
const DEFAULT_TASK_FILE_LIMIT = 10;

const GENERATED_PATH_PATTERN = /(^|\/)(dist|build|coverage|\.next|out)\//;

/** The single most-explanatory reason, rendered as one short, honest sentence — never raw weights/scores. */
function describeReason(reason: RankingReason): string {
  switch (reason.kind) {
    case 'filename-term':
      return `Filename matches the task (${reason.evidence}).`;
    case 'symbol-term':
      return `Exports a symbol matching the task (${reason.evidence}).`;
    case 'path-term':
      return `Path matches the task (${reason.evidence}).`;
    case 'workspace-match':
      return `Owning workspace matches the task (${reason.evidence}).`;
    case 'import-neighbor':
      return `Directly imported by a highly-ranked file (${reason.evidence}).`;
    case 'reverse-import-neighbor':
      return `Imports a highly-ranked file (${reason.evidence}).`;
    case 'test-counterpart':
      return `Test/production counterpart of a highly-ranked file (${reason.evidence}).`;
    case 'entry-point':
      return `Repository entry point (${reason.evidence}).`;
    case 'config-relevance':
      return `Configuration relevant to this task (${reason.evidence}).`;
    case 'multi-term-density':
      return `Matches multiple distinct task terms (${reason.evidence}).`;
    case 'workspace-locality':
      return `Near a strongly-matched file (${reason.evidence}).`;
    default:
      return reason.evidence;
  }
}

function describeRankedFile(file: RankedFile): string {
  const topReason = file.reasons[0];
  const description = topReason ? describeReason(topReason) : 'Matches the task.';
  return `\`${file.path}\`\n  - ${description}`;
}

/**
 * Generates compact, agent-ready context for the repository, optionally
 * focused on a task. When `maxTokens` is set, list-based sections are
 * shrunk through a fixed sequence of caps (20 → 10 → 5 → 3 → 1) until the
 * estimate fits; this keeps truncation deterministic for the same snapshot
 * and options rather than depending on iteration order or timing.
 */
export function generateContext(
  snapshot: RepositorySnapshot,
  options: ContextOptions = {},
): ContextResult {
  const ranking = options.task ? rankFilesForTask({ task: options.task, snapshot }) : null;
  const caps = [20, 10, 5, 3, 1];

  let content = '';
  let truncated = false;

  for (let i = 0; i < caps.length; i++) {
    content = renderContext(snapshot, options, ranking?.files ?? null, caps[i] as number);
    const tokens = estimateTokens(content);
    if (!options.maxTokens || tokens <= options.maxTokens) {
      if (i > 0) truncated = true;
      return {
        content,
        estimatedTokens: tokens,
        truncated,
        task: options.task ?? null,
        rankedFiles: ranking?.files ?? [],
      };
    }
  }

  // Even the most aggressive cap did not fit; hard-truncate as a last resort.
  const maxChars = (options.maxTokens ?? estimateTokens(content)) * 4;
  const finalContent =
    content.length > maxChars
      ? `${content.slice(0, maxChars)}\n\n_[truncated to fit --max-tokens]_\n`
      : content;
  return {
    content: finalContent,
    estimatedTokens: estimateTokens(finalContent),
    truncated: true,
    task: options.task ?? null,
    rankedFiles: ranking?.files ?? [],
  };
}

function renderContext(
  snapshot: RepositorySnapshot,
  options: ContextOptions,
  rankedFiles: RankedFile[] | null,
  cap: number,
): string {
  const sections: string[] = [];

  sections.push(`# Recall Context: ${snapshot.repository.name}`);
  if (options.task) {
    sections.push(`\n_Generated for task: "${options.task}"_`);
  }

  sections.push('\n## 1. Project summary\n');
  const profileLine = snapshot.projectProfile
    ? `\n- Profile: ${formatProjectProfileInline(snapshot.projectProfile)}`
    : '';
  sections.push(
    `- Repository: ${snapshot.repository.name}\n- Package manager: ${snapshot.ecosystem.packageManager}${snapshot.ecosystem.isMonorepo ? ' (monorepo)' : ''}\n- Primary frameworks: ${[...new Set(snapshot.frameworks.map((f) => f.name))].join(', ') || 'none detected'}${profileLine}`,
  );

  sections.push('\n## 2. Repository layout\n');
  sections.push(
    bulletList(
      snapshot.workspaces.slice(0, cap).map((w) => `\`${w.path}\` — ${w.kind} (${w.name})`),
    ),
  );

  sections.push('\n## 3. Architecture\n');
  const runtimeEdges = snapshot.internalEdges
    .filter((e) => e.kind === 'workspace' && e.dependencyType !== 'development')
    .slice(0, cap);
  sections.push(bulletList(runtimeEdges.map((e) => `\`${e.from}\` → \`${e.to}\``)));
  const devEdges = snapshot.internalEdges.filter(
    (e) => e.kind === 'workspace' && e.dependencyType === 'development',
  );
  if (devEdges.length > 0) {
    sections.push('\n### Development-only workspace dependencies\n');
    sections.push(
      bulletList(devEdges.slice(0, cap).map((e) => `\`${e.from}\` → \`${e.to}\` (dev)`)),
    );
  }

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

  sections.push('\n## 10. Files an agent should read first\n');
  sections.push(filesToReadSection(snapshot, rankedFiles, Math.min(cap, DEFAULT_TASK_FILE_LIMIT)));

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

function filesToReadSection(
  snapshot: RepositorySnapshot,
  rankedFiles: RankedFile[] | null,
  limit: number,
): string {
  if (rankedFiles !== null) {
    if (rankedFiles.length === 0) return '_None detected._';
    const shown = rankedFiles.slice(0, limit);
    return shown.map((f, i) => `${i + 1}. ${describeRankedFile(f)}`).join('\n');
  }

  // No task given: fall back to entry points, always resolved to their
  // source counterpart when one exists, and never a generated/build path —
  // an agent should never be told to "read" build output.
  const readable = snapshot.entryPoints
    .map((e) => e.sourcePath ?? e.path)
    .filter((path) => !GENERATED_PATH_PATTERN.test(path));
  const unique = [...new Set(readable)].slice(0, limit);
  return bulletList(unique);
}

function formatProjectProfileInline(
  profile: NonNullable<RepositorySnapshot['projectProfile']>,
): string {
  const parts: string[] = [profile.language];
  const label: Record<string, string | null> = {
    cli: 'CLI',
    'web-app': 'web app',
    'api-service': 'API service',
    library: 'library',
    unknown: null,
  };
  const applicationLabel = label[profile.applicationType];
  if (applicationLabel) parts.push(applicationLabel);
  if (profile.repositoryType === 'monorepo') parts.push('monorepo');
  return parts.join(' ');
}

function gitStateLines(git: GitMetadata | null): string[] {
  if (!git) return ['Not a Git repository.'];
  return [
    `Branch: ${git.branch ?? 'unknown'}`,
    `Commit: ${git.commit ?? 'unknown'}`,
    `Working tree: ${git.isDirty ? 'has uncommitted changes' : 'clean'}`,
  ];
}

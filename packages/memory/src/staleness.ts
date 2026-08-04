import type { ChangeReport } from './diff.js';

export interface StalenessInput {
  /**
   * Whether a snapshot has actually been persisted (`snapshots/latest.json`
   * exists and parses). Tracked separately from `snapshotCommit` because a
   * snapshot taken in a non-Git repository legitimately has no commit at
   * all — treating a null commit as "no snapshot" would wrongly mark every
   * non-Git repository stale immediately after a successful init.
   */
  snapshotExists: boolean;
  snapshotCommit: string | null;
  currentCommit: string | null;
  changeReport: ChangeReport | null;
}

export interface StalenessResult {
  stale: boolean;
  reasons: string[];
}

export function computeStaleness(input: StalenessInput): StalenessResult {
  const reasons: string[] = [];

  if (!input.snapshotExists) {
    reasons.push('no snapshot has been recorded yet');
  } else if (
    input.snapshotCommit !== null &&
    input.currentCommit !== null &&
    input.snapshotCommit !== input.currentCommit
  ) {
    reasons.push(
      `repository is at commit ${input.currentCommit} but the last snapshot was taken at ${input.snapshotCommit}`,
    );
  }

  if (input.changeReport?.hasChanges) {
    const parts: string[] = [];
    if (input.changeReport.filesAdded.length)
      parts.push(`${input.changeReport.filesAdded.length} file(s) added`);
    if (input.changeReport.filesRemoved.length)
      parts.push(`${input.changeReport.filesRemoved.length} file(s) removed`);
    if (input.changeReport.filesChanged.length)
      parts.push(`${input.changeReport.filesChanged.length} file(s) changed`);
    if (parts.length > 0)
      reasons.push(`repository contents differ from the last snapshot: ${parts.join(', ')}`);
  }

  return { stale: reasons.length > 0, reasons };
}

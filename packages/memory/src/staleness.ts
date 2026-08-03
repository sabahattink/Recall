import type { ChangeReport } from './diff.js';

export interface StalenessInput {
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

  if (input.snapshotCommit === null) {
    reasons.push('no snapshot has been recorded yet');
  } else if (input.currentCommit !== null && input.snapshotCommit !== input.currentCommit) {
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

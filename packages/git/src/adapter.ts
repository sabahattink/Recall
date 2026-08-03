import { execa } from 'execa';
import type { GitMetadata } from '@recall-ai/schemas';

export class GitCommandError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = 'GitCommandError';
  }
}

export interface ChangedFileEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown';
}

/**
 * Thin, safe wrapper around the `git` CLI. Every method is read-only: Recall
 * never writes to the user's Git state. Commands run with a fixed argument
 * array (never a shell string) to avoid command injection, and all calls are
 * scoped to `cwd` via `git -C`.
 */
export class GitAdapter {
  constructor(private readonly cwd: string) {}

  private async run(args: string[]): Promise<string> {
    try {
      const result = await execa('git', ['-C', this.cwd, ...args], {
        timeout: 15_000,
        reject: true,
      });
      // Only trailing newlines are stripped here, not leading whitespace:
      // `git status --porcelain` uses meaningful leading spaces in its
      // per-line status codes (e.g. " M path"), which a blanket `.trim()`
      // would corrupt on the first line.
      return result.stdout.replace(/\n+$/, '');
    } catch (error) {
      const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
      throw new GitCommandError(`git ${args.join(' ')} failed`, stderr);
    }
  }

  async isRepository(): Promise<boolean> {
    try {
      const result = await execa('git', ['-C', this.cwd, 'rev-parse', '--is-inside-work-tree'], {
        timeout: 15_000,
        reject: false,
      });
      return result.exitCode === 0 && result.stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  async currentBranch(): Promise<string | null> {
    try {
      const branch = await this.run(['rev-parse', '--abbrev-ref', 'HEAD']);
      return branch === 'HEAD' ? null : branch;
    } catch {
      return null;
    }
  }

  async currentCommit(): Promise<string | null> {
    try {
      return await this.run(['rev-parse', 'HEAD']);
    } catch {
      return null;
    }
  }

  async isDirty(): Promise<boolean> {
    try {
      const status = await this.run(['status', '--porcelain']);
      return status.length > 0;
    } catch {
      return false;
    }
  }

  async remoteUrl(): Promise<string | null> {
    try {
      return await this.run(['remote', 'get-url', 'origin']);
    } catch {
      return null;
    }
  }

  async defaultBranch(): Promise<string | null> {
    try {
      const ref = await this.run(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      const parts = ref.split('/');
      return parts.length > 0 ? (parts[parts.length - 1] ?? null) : null;
    } catch {
      // Fall back to the current branch when no remote HEAD is configured
      // (common in freshly initialized or local-only repositories).
      return this.currentBranch();
    }
  }

  /** Files with uncommitted changes (staged, unstaged, and untracked). */
  async changedFiles(): Promise<string[]> {
    try {
      const status = await this.run(['status', '--porcelain', '-uall']);
      if (!status) return [];
      return status
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3).trim())
        .map((path) => path.split(' -> ').pop() as string);
    } catch {
      return [];
    }
  }

  /** Files changed between two refs (e.g. for `recall update --since`). */
  async diffNameStatus(fromRef: string, toRef = 'HEAD'): Promise<ChangedFileEntry[]> {
    const output = await this.run(['diff', '--name-status', `${fromRef}..${toRef}`]);
    if (!output) return [];
    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [rawStatus, ...pathParts] = line.split('\t');
        const path = pathParts[pathParts.length - 1] ?? '';
        return { path, status: mapStatus(rawStatus ?? '') };
      });
  }

  async log(maxCount = 20): Promise<Array<{ sha: string; message: string; date: string }>> {
    const output = await this.run([
      'log',
      `--max-count=${maxCount}`,
      '--pretty=format:%H%x1f%s%x1f%cI%x1e',
    ]);
    if (!output) return [];
    return output
      .split('\x1e')
      .filter(Boolean)
      .map((entry) => {
        const [sha, message, date] = entry.replace(/^\n/, '').split('\x1f');
        return { sha: sha ?? '', message: message ?? '', date: date ?? '' };
      });
  }

  /** All paths Git currently tracks, relative to the repository root. */
  async listTrackedFiles(): Promise<string[]> {
    try {
      const output = await this.run(['ls-files']);
      return output ? output.split('\n').filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  async refExists(ref: string): Promise<boolean> {
    try {
      await this.run(['rev-parse', '--verify', ref]);
      return true;
    } catch {
      return false;
    }
  }

  async collectMetadata(): Promise<GitMetadata | null> {
    if (!(await this.isRepository())) return null;
    const [branch, commit, isDirty, remoteUrl, defaultBranch, changedFiles] = await Promise.all([
      this.currentBranch(),
      this.currentCommit(),
      this.isDirty(),
      this.remoteUrl(),
      this.defaultBranch(),
      this.changedFiles(),
    ]);
    return {
      isRepository: true,
      branch,
      commit,
      isDirty,
      remoteUrl,
      defaultBranch,
      changedFiles,
    };
  }
}

/** Checks whether the `git` executable is available on PATH at all. */
export async function isGitInstalled(): Promise<boolean> {
  try {
    await execa('git', ['--version'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function mapStatus(code: string): ChangedFileEntry['status'] {
  const letter = code.charAt(0);
  switch (letter) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    default:
      return 'unknown';
  }
}

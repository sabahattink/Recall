import { execa } from 'execa';

/**
 * Author/committer identity supplied via environment variables rather than
 * two extra `git config` invocations per repo. Git reads these directly, so
 * a repo never needs local config written for tests to produce a valid
 * commit — this halves the process-spawn count of `initGitRepo` (1 spawn
 * instead of 3), which matters on Windows CI where each `git.exe` spawn
 * carries real process-creation/AV-scan overhead.
 */
const TEST_GIT_IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'Recall Test',
  GIT_AUTHOR_EMAIL: 'recall-test@example.com',
  GIT_COMMITTER_NAME: 'Recall Test',
  GIT_COMMITTER_EMAIL: 'recall-test@example.com',
};

export async function initGitRepo(dir: string, defaultBranch = 'main'): Promise<void> {
  await execa('git', ['init', '-q', '-b', defaultBranch, dir]);
}

export async function commitAll(dir: string, message: string): Promise<void> {
  await execa('git', ['-C', dir, 'add', '-A']);
  await execa('git', ['-C', dir, 'commit', '-q', '-m', message], { env: TEST_GIT_IDENTITY_ENV });
}

export async function currentCommit(dir: string): Promise<string> {
  const result = await execa('git', ['-C', dir, 'rev-parse', 'HEAD']);
  return result.stdout.trim();
}

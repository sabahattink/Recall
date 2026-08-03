import { execa } from 'execa';

export async function initGitRepo(dir: string, defaultBranch = 'main'): Promise<void> {
  await execa('git', ['init', '-q', '-b', defaultBranch, dir]);
  await execa('git', ['-C', dir, 'config', 'user.email', 'recall-test@example.com']);
  await execa('git', ['-C', dir, 'config', 'user.name', 'Recall Test']);
}

export async function commitAll(dir: string, message: string): Promise<void> {
  await execa('git', ['-C', dir, 'add', '-A']);
  await execa('git', ['-C', dir, 'commit', '-q', '-m', message]);
}

export async function currentCommit(dir: string): Promise<string> {
  const result = await execa('git', ['-C', dir, 'rev-parse', 'HEAD']);
  return result.stdout.trim();
}

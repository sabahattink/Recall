import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import {
  commitAll,
  createTempDir,
  initGitRepo,
  integrationTestTimeout,
  removeTempDir,
} from '@recall-ai/test-fixtures';
import { GitAdapter, resolveGitExecutable, sanitizeRemoteUrl } from '../adapter.js';

async function git(dir: string, ...args: string[]): Promise<void> {
  await execa('git', ['-C', dir, ...args]);
}

describe('GitAdapter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await createTempDir('recall-git-');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('returns null metadata outside a repository', async () => {
    const adapter = new GitAdapter(dir);
    expect(await adapter.isRepository()).toBe(false);
    expect(await adapter.collectMetadata()).toBeNull();
  });

  it(
    'reports a null commit for a repository with no commits yet',
    async () => {
      await initGitRepo(dir);
      expect(await new GitAdapter(dir).collectMetadata()).toEqual({
        commit: null,
        defaultBranch: null,
        remoteUrl: null,
      });
    },
    integrationTestTimeout,
  );

  it(
    'reads the HEAD commit after the first commit',
    async () => {
      await initGitRepo(dir);
      await writeFile(join(dir, 'README.md'), '# hello\n');
      await commitAll(dir, 'chore: initial commit');

      const metadata = await new GitAdapter(dir).collectMetadata();
      expect(metadata?.commit).toMatch(/^[0-9a-f]{40}$/);
    },
    integrationTestTimeout,
  );

  it(
    'reads the default branch only from origin/HEAD, never from the checked-out branch',
    async () => {
      await initGitRepo(dir, 'feature');
      expect(await new GitAdapter(dir).defaultBranch()).toBeNull();

      await git(dir, 'remote', 'add', 'origin', 'https://example.com/acme/app.git');
      await git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
      expect(await new GitAdapter(dir).defaultBranch()).toBe('main');
    },
    integrationTestTimeout,
  );

  it(
    'strips credentials from the origin remote URL',
    async () => {
      await initGitRepo(dir);
      await git(dir, 'remote', 'add', 'origin', 'https://bot:s3cr3t@example.com/acme/app.git');
      expect(await new GitAdapter(dir).remoteUrl()).toBe('https://example.com/acme/app.git');
    },
    integrationTestTimeout,
  );

  it(
    "never executes a command from the repository's own core.fsmonitor setting",
    async () => {
      await initGitRepo(dir);
      await writeFile(join(dir, 'README.md'), '# hello\n');
      await commitAll(dir, 'chore: initial commit');
      const marker = join(dir, 'fsmonitor-ran');
      const markerForShell = marker.split('\\').join('/');
      await git(
        dir,
        'config',
        'core.fsmonitor',
        `node -e "require('fs').writeFileSync('${markerForShell}', '')"`,
      );

      await new GitAdapter(dir).collectMetadata();

      await expect(access(marker)).rejects.toThrow();
    },
    integrationTestTimeout,
  );
});

describe('sanitizeRemoteUrl', () => {
  it('removes the whole userinfo from an HTTPS URL', () => {
    expect(sanitizeRemoteUrl('https://x-access-token:ghp_abc@github.com/o/r.git')).toBe(
      'https://github.com/o/r.git',
    );
    expect(sanitizeRemoteUrl('https://ghp_abc@github.com/o/r.git')).toBe(
      'https://github.com/o/r.git',
    );
  });

  it('keeps the account name but drops a password from an ssh:// URL', () => {
    expect(sanitizeRemoteUrl('ssh://git:pw@github.com/o/r.git')).toBe(
      'ssh://git@github.com/o/r.git',
    );
  });

  it('leaves credential-free and scp-like remotes unchanged', () => {
    expect(sanitizeRemoteUrl('https://github.com/o/r.git')).toBe('https://github.com/o/r.git');
    expect(sanitizeRemoteUrl('git@github.com:o/r.git')).toBe('git@github.com:o/r.git');
  });

  it('strips credentials even when the URL does not parse', () => {
    expect(sanitizeRemoteUrl('https://user:pa/ss@host/r.git')).not.toContain('user');
    expect(sanitizeRemoteUrl('https://user:p#ss@host/r.git')).toBe('https://host/r.git');
  });
});

describe('resolveGitExecutable', () => {
  it('never resolves through a relative PATH entry or the current directory', () => {
    const probed: string[] = [];
    const result = resolveGitExecutable({
      pathEnv: '.;tools;;C:\\Program Files\\Git\\cmd',
      platform: 'win32',
      isExecutableFile: (path) => {
        probed.push(path);
        return true;
      },
    });
    expect(result).toBe('C:\\Program Files\\Git\\cmd\\git.exe');
    expect(probed).toEqual(['C:\\Program Files\\Git\\cmd\\git.exe']);
  });

  it('returns the first absolute PATH entry that holds an executable git', () => {
    const result = resolveGitExecutable({
      pathEnv: '/usr/local/bin:/usr/bin',
      platform: 'linux',
      isExecutableFile: (path) => path === '/usr/bin/git',
    });
    expect(result).toBe('/usr/bin/git');
  });

  it('returns null when git is not on PATH, so metadata is simply absent', () => {
    expect(
      resolveGitExecutable({
        pathEnv: '/nowhere',
        platform: 'linux',
        isExecutableFile: () => false,
      }),
    ).toBeNull();
  });
});

describe('GitAdapter environment isolation', () => {
  let dir: string;
  let other: string;
  const savedGitDir = process.env.GIT_DIR;

  beforeEach(async () => {
    dir = await createTempDir('recall-git-');
    other = await createTempDir('recall-git-other-');
  });

  afterEach(async () => {
    if (savedGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = savedGitDir;
    await removeTempDir(dir);
    await removeTempDir(other);
  });

  it(
    'ignores an inherited GIT_DIR that points at a different repository',
    async () => {
      await initGitRepo(other);
      await writeFile(join(other, 'a.txt'), 'a\n');
      await commitAll(other, 'chore: other');
      process.env.GIT_DIR = join(other, '.git');

      expect(await new GitAdapter(dir).collectMetadata()).toBeNull();
    },
    integrationTestTimeout,
  );
});

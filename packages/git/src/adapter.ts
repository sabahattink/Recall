import { execFile } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { posix, win32 } from 'node:path';
import { stripUrlCredentials, type GitMetadata } from '@recall-ai/schemas';

const GIT_TIMEOUT_MS = 15_000;

/**
 * Prepended to every invocation. A repository's own `.git/config` is
 * untrusted input: `core.fsmonitor` names a command Git executes whenever
 * it refreshes the index, which would let a cloned repository run code on
 * the developer's machine merely by being initialized (spec §20, "No code
 * execution beyond reading"). None of the commands below read the index,
 * but the override is applied unconditionally so that stays true no matter
 * which commands are added later.
 */
const SAFETY_ARGS = ['-c', 'core.fsmonitor=false'];

/**
 * Environment variables that would point Git at a different repository
 * than the one being initialized (set, for example, when Recall runs from
 * inside a Git hook). They are removed so `git -C <root>` means exactly
 * `<root>`.
 */
const REDIRECTING_GIT_VARIABLES = new Set([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_NAMESPACE',
]);

/**
 * `user:pa/ss@` — a password containing an unencoded `/` is not valid URL
 * syntax, so the generic stripper (which stops at `/`) skips it, but Git
 * still accepts such a remote. A remote URL is a single URL, so a `:`
 * before the first `/` followed by an `@` can only be userinfo here.
 */
const MALFORMED_USERINFO = /^([a-z][a-z0-9+.-]*:\/\/)[^@/]*:[^@]*@/i;

/**
 * Removes credentials from a remote URL before it is recorded anywhere —
 * `https://user:token@host/repo.git` is a common way to embed an access
 * token in a remote, and `memory.json` is meant to be committed and shared.
 */
export function sanitizeRemoteUrl(remoteUrl: string): string {
  return stripUrlCredentials(remoteUrl).replace(MALFORMED_USERINFO, '$1');
}

export interface ExecutableLookup {
  pathEnv: string | undefined;
  platform: NodeJS.Platform;
  isExecutableFile: (path: string) => boolean;
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    if (process.platform !== 'win32') accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds the `git` executable on PATH, considering absolute PATH entries
 * only. Spawning a bare `git` is not safe: on Windows, process creation
 * searches the current directory before PATH, so a repository that
 * contains its own `git.exe` would have it executed by `recall init` run
 * from the repository root. Resolving to an absolute path first means no
 * search ever happens, and a relative PATH entry (including `.`) is never
 * trusted.
 */
export function resolveGitExecutable(
  lookup: ExecutableLookup = {
    pathEnv: process.env.PATH ?? process.env.Path,
    platform: process.platform,
    isExecutableFile,
  },
): string | null {
  const windows = lookup.platform === 'win32';
  const paths = windows ? win32 : posix;
  const name = windows ? 'git.exe' : 'git';
  for (const rawEntry of (lookup.pathEnv ?? '').split(paths.delimiter)) {
    const entry = rawEntry.trim().replace(/^"(.*)"$/, '$1');
    if (!entry || !paths.isAbsolute(entry)) continue;
    const candidate = paths.join(entry, name);
    if (lookup.isExecutableFile(candidate)) return candidate;
  }
  return null;
}

let cachedGitExecutable: string | null | undefined;

function gitExecutable(): string | null {
  if (cachedGitExecutable === undefined) cachedGitExecutable = resolveGitExecutable();
  return cachedGitExecutable;
}

function gitEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !REDIRECTING_GIT_VARIABLES.has(name)),
  );
}

function runGit(cwd: string, args: string[]): Promise<string | null> {
  const git = gitExecutable();
  if (!git) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(
      git,
      [...SAFETY_ARGS, '-C', cwd, ...args],
      { timeout: GIT_TIMEOUT_MS, windowsHide: true, encoding: 'utf8', env: gitEnvironment() },
      (error, stdout) => {
        // Every caller treats "no answer" identically to "no such value":
        // a missing remote, an unborn HEAD, Git not installed, or a
        // directory Git refuses to trust all mean the field is absent.
        if (error) resolve(null);
        else resolve(stdout.replace(/\r?\n+$/, ''));
      },
    );
  });
}

/**
 * Thin, read-only wrapper around the `git` CLI. Commands run with a fixed
 * argument array (never a shell string) against an absolute `git` path and
 * are scoped to `cwd` via `git -C`. Nothing here writes to the
 * repository's Git state.
 */
export class GitAdapter {
  constructor(private readonly cwd: string) {}

  async isRepository(): Promise<boolean> {
    return (await runGit(this.cwd, ['rev-parse', '--is-inside-work-tree'])) === 'true';
  }

  /** The full SHA `HEAD` resolves to, or `null` for a repository with no commits. */
  async currentCommit(): Promise<string | null> {
    const sha = await runGit(this.cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    return sha && /^[0-9a-f]{40,64}$/.test(sha) ? sha : null;
  }

  /**
   * The credential-free URL of the `origin` remote as configured in this
   * repository, or `null` when there is none. Read from the repository's
   * own config rather than with `git remote get-url`, which applies the
   * user's global `url.*.insteadOf` rewrites and would make the recorded
   * URL depend on whose machine Recall runs on.
   */
  async remoteUrl(): Promise<string | null> {
    const url = await runGit(this.cwd, ['config', '--local', '--get', 'remote.origin.url']);
    return url ? sanitizeRemoteUrl(url) : null;
  }

  /**
   * The branch `origin/HEAD` points at, or `null` when it is not recorded
   * locally. Never falls back to the currently checked-out branch: that is
   * a guess about the default branch, not evidence of it.
   */
  async defaultBranch(): Promise<string | null> {
    const ref = await runGit(this.cwd, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
    const prefix = 'refs/remotes/origin/';
    return ref?.startsWith(prefix) ? ref.slice(prefix.length) || null : null;
  }

  /** All metadata at once, or `null` when `cwd` is not inside a Git work tree. */
  async collectMetadata(): Promise<GitMetadata | null> {
    if (!(await this.isRepository())) return null;
    const [commit, defaultBranch, remoteUrl] = await Promise.all([
      this.currentCommit(),
      this.defaultBranch(),
      this.remoteUrl(),
    ]);
    return { commit, defaultBranch, remoteUrl };
  }
}

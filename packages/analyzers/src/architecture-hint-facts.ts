import { join } from 'node:path';
import type { DirectoryRole, FactOf } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';
import { compareStrings } from '@recall-ai/schemas';
import { basename, dirname } from './path-utils.js';
import {
  CONFIG_FILE_PATTERN,
  DOCUMENTATION_PATTERN,
  GENERATED_FILE_PATTERN,
  SOURCE_EXTENSIONS,
  TEST_FILE_PATTERN,
} from './constants.js';

/**
 * Per-file classification patterns from `constants.ts`, each tested
 * against the field it was written for (full path vs. basename), rather
 * than a directory-name-based heuristic. Order is the emission order for a
 * directory's roles.
 */
const DIRECTORY_ROLE_MATCHERS: Array<{
  role: DirectoryRole;
  matches: (file: WalkedFile) => boolean;
}> = [
  { role: 'source', matches: (f) => SOURCE_EXTENSIONS.has(f.extension) },
  { role: 'test', matches: (f) => TEST_FILE_PATTERN.test(f.path) },
  { role: 'config', matches: (f) => CONFIG_FILE_PATTERN.test(basename(f.path)) },
  { role: 'documentation', matches: (f) => DOCUMENTATION_PATTERN.test(f.path) },
  { role: 'generated', matches: (f) => GENERATED_FILE_PATTERN.test(f.path) },
];

/** Caps the evidence array for a busy directory rather than citing every matching file. */
const MAX_EVIDENCE_FILES_PER_ROLE = 3;

function topLevelDirectory(path: string): string | null {
  const slash = path.indexOf('/');
  return slash === -1 ? null : path.slice(0, slash);
}

/**
 * Joins a manifest-relative path onto its workspace directory, or `null`
 * when nothing is left to point at (`"main": "./"`, `"bin": ""`) — an
 * empty target is not evidence of an entry point.
 */
function joinRepoPath(dir: string, relativePath: string): string | null {
  const cleaned = relativePath.replace(/^(\.\/)+/, '').replace(/\/+$/, '');
  if (!cleaned || cleaned === '.') return null;
  return dir ? `${dir}/${cleaned}` : cleaned;
}

/**
 * Detects directory roles (source/test/config/documentation/generated) and
 * entry points, from the file list a prior `walkRepository` call already
 * produced plus targeted reads of every `package.json` `files` already
 * confirmed exists. No directory is walked again.
 *
 * A directory is never given a role because of its own name — a directory
 * literally named "test" with no files matching the test pattern inside it
 * gets no Fact. The evidence is always the real, matching file(s).
 *
 * Entry points come only from a `package.json`'s `bin`/`main` fields —
 * exact manifest evidence. Framework-convention guesses (e.g. assuming
 * NestJS's `src/main.ts`) are never added: a fact is never inferred merely
 * because it matches a common convention. The resolved path is not required to exist in `files`
 * — a `bin`/`main` field conventionally points at build output, which
 * SCAN-02's walk already excludes by design; the manifest field itself is
 * the evidence, not the target file's presence.
 */
export async function detectArchitectureHintFacts(
  files: WalkedFile[],
  root: string,
): Promise<Array<FactOf<'directory'> | FactOf<'architecture-hint'>>> {
  return [...detectDirectoryRoleFacts(files), ...(await detectEntryPointFacts(files, root))];
}

function detectDirectoryRoleFacts(files: WalkedFile[]): FactOf<'directory'>[] {
  const filesByDirectory = new Map<string, WalkedFile[]>();
  for (const file of files) {
    const dir = topLevelDirectory(file.path);
    if (!dir) continue;
    const existing = filesByDirectory.get(dir);
    if (existing) existing.push(file);
    else filesByDirectory.set(dir, [file]);
  }

  const directories = [...filesByDirectory.keys()].sort(compareStrings);
  const facts: FactOf<'directory'>[] = [];

  for (const dir of directories) {
    const dirFiles = filesByDirectory.get(dir) ?? [];
    for (const { role, matches } of DIRECTORY_ROLE_MATCHERS) {
      const matched = dirFiles.filter(matches).sort((a, b) => compareStrings(a.path, b.path));
      if (matched.length === 0) continue;

      facts.push({
        category: 'directory',
        value: { path: dir, role },
        evidence: matched.slice(0, MAX_EVIDENCE_FILES_PER_ROLE).map((f) => ({
          path: f.path,
          reason: `matches the ${role} file pattern`,
        })),
      });
    }
  }

  return facts;
}

interface PackageJsonShape {
  name?: unknown;
  bin?: unknown;
  main?: unknown;
}

/**
 * Normalizes a manifest `bin` field into name → path pairs, keeping only
 * string entries. A malformed manifest is not evidence of anything, so a
 * non-string value produces no entry rather than a fabricated one.
 */
function binEntriesOf(bin: unknown, fallbackName: string): Array<[string, string]> {
  if (typeof bin === 'string') return [[fallbackName, bin]];
  if (typeof bin !== 'object' || bin === null) return [];
  return Object.entries(bin)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .sort(([a], [b]) => compareStrings(a, b));
}

async function detectEntryPointFacts(
  files: WalkedFile[],
  root: string,
): Promise<FactOf<'architecture-hint'>[]> {
  const packageJsonFiles = files
    .filter((f) => basename(f.path) === 'package.json')
    .sort((a, b) => compareStrings(a.path, b.path));

  const facts: FactOf<'architecture-hint'>[] = [];

  for (const pkgFile of packageJsonFiles) {
    const content = await readJsonIfExists<PackageJsonShape>(join(root, pkgFile.path));
    if (!content) continue;

    const workspaceDir = dirname(pkgFile.path);

    const binName =
      typeof content.name === 'string' ? content.name : basename(workspaceDir) || 'root';
    for (const [name, binPath] of binEntriesOf(content.bin, binName)) {
      const path = joinRepoPath(workspaceDir, binPath);
      if (!path) continue;
      facts.push({
        category: 'architecture-hint',
        value: { path, kind: 'bin', workspace: workspaceDir || null },
        evidence: [{ path: pkgFile.path, reason: `bin entry "${name}" declared` }],
      });
    }

    const mainPath =
      typeof content.main === 'string' ? joinRepoPath(workspaceDir, content.main) : null;
    if (mainPath) {
      facts.push({
        category: 'architecture-hint',
        value: { path: mainPath, kind: 'main', workspace: workspaceDir || null },
        evidence: [{ path: pkgFile.path, reason: '"main" field declared' }],
      });
    }
  }

  return facts;
}

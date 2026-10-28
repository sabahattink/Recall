import { join } from 'node:path';
import type { Fact } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readJsonIfExists } from './json.js';
import {
  CONFIG_FILE_PATTERN,
  DOCUMENTATION_PATTERN,
  GENERATED_FILE_PATTERN,
  SOURCE_EXTENSIONS,
  TEST_FILE_PATTERN,
} from './constants.js';

type DirectoryRole = 'source' | 'test' | 'config' | 'documentation' | 'generated';

/**
 * Reuses the exact per-file classification patterns already established
 * and validated in `constants.ts` — the same ones `file-classification.ts`
 * applies per file, tested against the same field (full path vs. basename)
 * that module already uses for each — rather than inventing a new,
 * directory-name-based heuristic. Order is the emission order for a
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

function basename(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}

function topLevelDirectory(path: string): string | null {
  const slash = path.indexOf('/');
  return slash === -1 ? null : path.slice(0, slash);
}

function dirnameOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

function joinRepoPath(dir: string, relativePath: string): string {
  const cleaned = relativePath.replace(/^\.\//, '');
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
 * gets no Fact. The evidence is always the real, matching file(s), the same
 * way `file-classification.ts` already classifies individual files.
 *
 * Entry points come only from a `package.json`'s `bin`/`main` fields —
 * exact manifest evidence. Unlike the pre-existing (unrelated, untouched)
 * `detectEntryPoints`, this detector does not add framework-convention
 * guesses (e.g. assuming NestJS's `src/main.ts`): per this task's
 * instructions, a fact is never inferred merely because it matches a
 * common convention. The resolved path is not required to exist in `files`
 * — a `bin`/`main` field conventionally points at build output, which
 * SCAN-02's walk already excludes by design; the manifest field itself is
 * the evidence, not the target file's presence.
 */
export async function detectArchitectureHintFacts(
  files: WalkedFile[],
  root: string,
): Promise<Fact[]> {
  return [...detectDirectoryRoleFacts(files), ...(await detectEntryPointFacts(files, root))];
}

function detectDirectoryRoleFacts(files: WalkedFile[]): Fact[] {
  const filesByDirectory = new Map<string, WalkedFile[]>();
  for (const file of files) {
    const dir = topLevelDirectory(file.path);
    if (!dir) continue;
    const existing = filesByDirectory.get(dir);
    if (existing) existing.push(file);
    else filesByDirectory.set(dir, [file]);
  }

  const directories = [...filesByDirectory.keys()].sort((a, b) => a.localeCompare(b));
  const facts: Fact[] = [];

  for (const dir of directories) {
    const dirFiles = filesByDirectory.get(dir) ?? [];
    for (const { role, matches } of DIRECTORY_ROLE_MATCHERS) {
      const matched = dirFiles.filter(matches).sort((a, b) => a.path.localeCompare(b.path));
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
  name?: string;
  bin?: string | Record<string, string>;
  main?: string;
}

async function detectEntryPointFacts(files: WalkedFile[], root: string): Promise<Fact[]> {
  const packageJsonFiles = files
    .filter((f) => basename(f.path) === 'package.json')
    .sort((a, b) => a.path.localeCompare(b.path));

  const facts: Fact[] = [];

  for (const pkgFile of packageJsonFiles) {
    const content = await readJsonIfExists<PackageJsonShape>(join(root, pkgFile.path));
    if (!content) continue;

    const workspaceDir = dirnameOf(pkgFile.path);

    if (content.bin) {
      const binName = content.name ?? (basename(workspaceDir) || 'root');
      const binEntries = typeof content.bin === 'string' ? { [binName]: content.bin } : content.bin;
      const names = Object.keys(binEntries).sort((a, b) => a.localeCompare(b));
      for (const name of names) {
        facts.push({
          category: 'architecture-hint',
          value: {
            path: joinRepoPath(workspaceDir, binEntries[name] as string),
            kind: 'bin',
            workspace: workspaceDir || null,
          },
          evidence: [{ path: pkgFile.path, reason: `bin entry "${name}" declared` }],
        });
      }
    }

    if (content.main) {
      facts.push({
        category: 'architecture-hint',
        value: {
          path: joinRepoPath(workspaceDir, content.main),
          kind: 'main',
          workspace: workspaceDir || null,
        },
        evidence: [{ path: pkgFile.path, reason: '"main" field declared' }],
      });
    }
  }

  return facts;
}

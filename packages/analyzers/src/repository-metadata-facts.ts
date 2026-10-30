import { join } from 'node:path';
import type { FactOf, GitMetadata, RepositoryMetadataKey } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { readTextIfExists } from './json.js';

type MetadataFact = FactOf<'repository-metadata'>;

interface ManifestIdentity {
  name: string | null;
  description: string | null;
}

/** Root manifests that may declare a name/description in, in preference order. */
const IDENTITY_SOURCES: Array<{
  path: string;
  read: (contents: string) => ManifestIdentity;
}> = [
  { path: 'package.json', read: readPackageJsonIdentity },
  { path: 'Cargo.toml', read: (c) => readTomlIdentity(c, ['package']) },
  { path: 'pyproject.toml', read: (c) => readTomlIdentity(c, ['project', 'tool.poetry']) },
  { path: 'go.mod', read: readGoModIdentity },
];

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readPackageJsonIdentity(contents: string): ManifestIdentity {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return { name: null, description: null };
  }
  if (typeof parsed !== 'object' || parsed === null) return { name: null, description: null };
  const record = parsed as Record<string, unknown>;
  return { name: nonEmptyString(record.name), description: nonEmptyString(record.description) };
}

/**
 * Reads a single-line string value of `key` from the first of `tables`
 * that declares it. Deliberately minimal — only `key = "basic"` and
 * `key = 'literal'` forms are recognized; anything else (multi-line strings,
 * inline tables, dotted keys) is treated as absent rather than guessed at.
 */
export function readTomlString(contents: string, tables: string[], key: string): string | null {
  const valuesByTable = new Map<string, string>();
  let currentTable: string | null = null;
  const assignment = new RegExp(
    `^${key}\\s*=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|'([^']*)')\\s*(?:#.*)?$`,
  );

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = /^\[([^[\]]+)\]\s*(?:#.*)?$/.exec(line);
    if (header) {
      currentTable = header[1]?.trim() ?? null;
      continue;
    }
    if (line.startsWith('[[')) {
      currentTable = null;
      continue;
    }
    if (currentTable === null || !tables.includes(currentTable)) continue;
    if (valuesByTable.has(currentTable)) continue;

    const match = assignment.exec(line);
    if (!match) continue;
    const value = match[1] !== undefined ? match[1].replace(/\\(["\\])/g, '$1') : (match[2] ?? '');
    valuesByTable.set(currentTable, value);
  }

  for (const table of tables) {
    const value = nonEmptyString(valuesByTable.get(table));
    if (value) return value;
  }
  return null;
}

function readTomlIdentity(contents: string, tables: string[]): ManifestIdentity {
  return {
    name: readTomlString(contents, tables, 'name'),
    description: readTomlString(contents, tables, 'description'),
  };
}

/** `module path`, `module "path"`, or either followed by a `//` comment. */
const GO_MODULE_DIRECTIVE = /^module\s+(?:"([^"\s]+)"|([^\s"]+))\s*(?:\/\/.*)?$/m;

function readGoModIdentity(contents: string): ManifestIdentity {
  const directive = GO_MODULE_DIRECTIVE.exec(contents);
  return { name: directive?.[1] ?? directive?.[2] ?? null, description: null };
}

function metadataFact(
  key: RepositoryMetadataKey,
  value: string,
  path: string,
  reason: string,
): MetadataFact {
  return { category: 'repository-metadata', value: { key, value }, evidence: [{ path, reason }] };
}

async function detectIdentityFacts(files: WalkedFile[], root: string): Promise<MetadataFact[]> {
  const present = new Set(files.map((f) => f.path));
  let name: MetadataFact | null = null;
  let description: MetadataFact | null = null;

  for (const source of IDENTITY_SOURCES) {
    if (name && description) break;
    if (!present.has(source.path)) continue;
    const contents = await readTextIfExists(join(root, source.path));
    if (contents === null) continue;

    const identity = source.read(contents);
    if (!name && identity.name) {
      name = metadataFact('name', identity.name, source.path, `name declared in ${source.path}`);
    }
    if (!description && identity.description) {
      description = metadataFact(
        'description',
        identity.description,
        source.path,
        `description declared in ${source.path}`,
      );
    }
  }

  return [name, description].filter((fact): fact is MetadataFact => fact !== null);
}

function detectGitFacts(git: GitMetadata | null): MetadataFact[] {
  if (!git) return [];
  const facts: MetadataFact[] = [];
  if (git.commit) {
    facts.push(metadataFact('commit', git.commit, '.', 'git HEAD resolves to this commit'));
  }
  if (git.defaultBranch) {
    facts.push(
      metadataFact(
        'default-branch',
        git.defaultBranch,
        '.',
        'refs/remotes/origin/HEAD points to this branch',
      ),
    );
  }
  if (git.remoteUrl) {
    facts.push(metadataFact('remote-url', git.remoteUrl, '.', 'URL of the git remote "origin"'));
  }
  return facts;
}

/**
 * Detects repository metadata: the project's name and description from the
 * first root manifest that declares them (package.json, Cargo.toml,
 * pyproject.toml, go.mod — in that order), plus the read-only Git metadata
 * a caller collected with `@recall-ai/git` and passed in.
 *
 * Git metadata is an input rather than something this package fetches:
 * `@recall-ai/analyzers` owns repository scanning, `@recall-ai/git` owns
 * talking to Git (docs/implementation-blueprint.md §3). A `null` `git`
 * (not a repository, or Git unavailable) simply yields no Git Facts — the
 * scan itself never fails for lack of Git (SCAN-10).
 *
 * The directory name is never used as a fallback project name: it is a
 * property of where a clone happens to live, not of the repository, and
 * would make output differ between machines (spec §9, Deterministic).
 */
export async function detectRepositoryMetadataFacts(
  files: WalkedFile[],
  root: string,
  git: GitMetadata | null,
): Promise<MetadataFact[]> {
  return [...(await detectIdentityFacts(files, root)), ...detectGitFacts(git)];
}

import type { RepositorySnapshot } from '@recall-ai/schemas';
import { bulletList, defaultTemplate } from './template.js';

export function glossaryTemplate(): (section: string) => string {
  return defaultTemplate(
    'Glossary',
    'Recurring domain terms extracted from directory and file names. Recall does not know what these terms mean to your team — definitions are left unresolved until a human confirms them.',
    'Fill in definitions for the unresolved terms below, or add domain terms Recall could not detect. This section is never modified by Recall.',
  );
}

const STOP_WORDS = new Set([
  'src',
  'lib',
  'index',
  'utils',
  'util',
  'common',
  'shared',
  'test',
  'tests',
  'spec',
  'specs',
  'dist',
  'build',
  'types',
  'type',
  'config',
  'main',
  'app',
  'apps',
  'packages',
  'package',
  'node',
  'modules',
  'module',
  'components',
  'component',
  'helpers',
  'helper',
  'constants',
  'interfaces',
  'services',
  'service',
  'controllers',
  'controller',
  'models',
  'model',
  'core',
  'root',
]);

function splitIdentifier(segment: string): string[] {
  return segment
    .replace(/\.[jt]sx?$/, '')
    .split(/[-_./]/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 2 && !STOP_WORDS.has(part) && /^[a-z]+$/.test(part));
}

export function generateGlossaryBody(snapshot: RepositorySnapshot): string {
  const occurrences = new Map<string, Set<string>>();

  for (const workspace of snapshot.workspaces) {
    const nameWithoutScope = workspace.name.split('/').pop() ?? workspace.name;
    for (const term of splitIdentifier(nameWithoutScope)) {
      addOccurrence(occurrences, term, workspace.path);
    }
  }

  for (const file of snapshot.files) {
    if (file.kind !== 'source') continue;
    for (const segment of file.path.split('/')) {
      for (const term of splitIdentifier(segment)) {
        addOccurrence(occurrences, term, file.path);
      }
    }
  }

  const ranked = [...occurrences.entries()]
    .filter(([, paths]) => paths.size >= 2)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, 20);

  if (ranked.length === 0) {
    return '_No recurring domain terms could be confidently extracted from this repository._';
  }

  return bulletList(
    ranked.map(([term, paths]) => {
      const examples = [...paths].sort().slice(0, 3).join(', ');
      return `**${term}** — definition: _unresolved_ (appears in ${paths.size} location(s), e.g. ${examples})`;
    }),
  );
}

function addOccurrence(map: Map<string, Set<string>>, term: string, path: string): void {
  const set = map.get(term) ?? new Set<string>();
  set.add(path);
  map.set(term, set);
}

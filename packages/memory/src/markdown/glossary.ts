import { dirname } from 'node:path';
import {
  DEFAULT_RECALL_CONFIG,
  shouldAnalyzePath,
  type RecallConfig,
  type RepositorySnapshot,
} from '@recall-ai/schemas';
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
  'libs',
  'index',
  'utils',
  'util',
  'common',
  'shared',
  'use',
  'case',
  'cases',
  'test',
  'tests',
  'spec',
  'specs',
  'fixture',
  'fixtures',
  'mock',
  'mocks',
  'example',
  'examples',
  'dist',
  'build',
  'types',
  'type',
  'config',
  'main',
  'app',
  'apps',
  'package',
  'packages',
  'service',
  'services',
  'node',
  'modules',
  'module',
  'components',
  'component',
  'helpers',
  'helper',
  'constants',
  'interfaces',
  'controllers',
  'controller',
  'models',
  'model',
  'core',
  'root',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'mts',
  'cts',
  'json',
  'md',
  'mdx',
  'yaml',
  'yml',
  'typescript',
  'javascript',
  'next',
  'nextjs',
  'nestjs',
  'react',
  'express',
  'fastify',
  'vue',
]);

function splitIdentifier(segment: string, stopWords: Set<string>): string[] {
  return segment
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[-_./]/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 2 && !stopWords.has(part) && /^[a-z]+$/.test(part));
}

interface TermOccurrence {
  directories: Set<string>;
  paths: Set<string>;
}

export function generateGlossaryBody(
  snapshot: RepositorySnapshot,
  config: RecallConfig = DEFAULT_RECALL_CONFIG,
): string {
  const dynamicStopWords = new Set(STOP_WORDS);

  for (const framework of snapshot.frameworks) {
    for (const term of splitIdentifier(framework.name, new Set())) dynamicStopWords.add(term);
  }

  // Workspace container directory names (apps/, packages/, services/, etc.)
  // describe repository layout, not domain language.
  for (const workspace of snapshot.workspaces) {
    if (workspace.path === '.') continue;
    const topLevel = workspace.path.split('/')[0];
    if (!topLevel) continue;
    for (const term of splitIdentifier(topLevel, new Set())) dynamicStopWords.add(term);
  }

  const occurrences = new Map<string, TermOccurrence>();

  for (const file of snapshot.files) {
    if (file.kind !== 'source') continue;
    if (!shouldAnalyzePath(file.path, config, file.kind)) continue;

    const directory = dirname(file.path).split('\\').join('/');
    for (const segment of file.path.split('/')) {
      for (const term of splitIdentifier(segment, dynamicStopWords)) {
        addOccurrence(occurrences, term, directory, file.path);
      }
    }
  }

  const ranked = [...occurrences.entries()]
    .filter(([, occurrence]) => occurrence.directories.size >= 2)
    .sort(
      (a, b) =>
        b[1].directories.size - a[1].directories.size ||
        b[1].paths.size - a[1].paths.size ||
        a[0].localeCompare(b[0]),
    )
    .slice(0, 15);

  if (ranked.length === 0) {
    return '_No recurring domain terms could be confidently extracted from this repository._';
  }

  return bulletList(
    ranked.map(([term, occurrence]) => {
      const examples = [...occurrence.paths].sort().slice(0, 3).join(', ');
      return `**${term}** — definition: _unresolved_ (appears across ${occurrence.directories.size} directories, e.g. ${examples})`;
    }),
  );
}

function addOccurrence(
  map: Map<string, TermOccurrence>,
  term: string,
  directory: string,
  path: string,
): void {
  const occurrence = map.get(term) ?? { directories: new Set<string>(), paths: new Set<string>() };
  occurrence.directories.add(directory);
  occurrence.paths.add(path);
  map.set(term, occurrence);
}

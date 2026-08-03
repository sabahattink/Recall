import { writeTree, type FileTree } from '../write-tree.js';

export function pnpmMonorepoTree(): FileTree {
  return {
    'package.json': JSON.stringify(
      {
        name: 'pnpm-monorepo-fixture',
        version: '1.0.0',
        private: true,
        packageManager: 'pnpm@9.12.0',
        engines: { node: '>=20' },
        scripts: {
          build: 'turbo run build',
          test: 'turbo run test',
        },
        devDependencies: {
          turbo: '^2.3.3',
          typescript: '^5.7.2',
        },
      },
      null,
      2,
    ),
    'pnpm-workspace.yaml': 'packages:\n  - "apps/*"\n  - "packages/*"\n',
    '.gitignore': 'node_modules/\ndist/\n.turbo/\n.env\n',
    'apps/api/package.json': JSON.stringify(
      {
        name: '@fixture/api',
        version: '1.0.0',
        private: true,
        main: 'src/index.ts',
        scripts: { start: 'node dist/index.js', build: 'tsc' },
        dependencies: {
          express: '^4.21.0',
          '@fixture/shared': 'workspace:*',
        },
      },
      null,
      2,
    ),
    'apps/api/src/index.ts': [
      "import express from 'express';",
      "import { formatUser } from '@fixture/shared';",
      '',
      'const app = express();',
      "app.get('/users/:id', (req, res) => {",
      "  res.json(formatUser({ id: req.params.id, name: 'Ada' }));",
      '});',
      '',
      'export default app;',
      '',
    ].join('\n'),
    'packages/shared/package.json': JSON.stringify(
      {
        name: '@fixture/shared',
        version: '1.0.0',
        private: true,
        main: 'src/index.ts',
      },
      null,
      2,
    ),
    'packages/shared/src/index.ts': [
      'export interface User {',
      '  id: string;',
      '  name: string;',
      '}',
      '',
      'export function formatUser(user: User): string {',
      '  return `${user.name} (${user.id})`;',
      '}',
      '',
    ].join('\n'),
    'packages/ui/package.json': JSON.stringify(
      {
        name: '@fixture/ui',
        version: '1.0.0',
        private: true,
        main: 'src/index.ts',
        dependencies: {
          '@fixture/shared': 'workspace:*',
        },
      },
      null,
      2,
    ),
    'packages/ui/src/index.ts': [
      "import { formatUser } from '@fixture/shared';",
      '',
      'export function renderUserBadge(name: string): string {',
      "  return formatUser({ id: '0', name });",
      '}',
      '',
    ].join('\n'),
  };
}

export async function buildPnpmMonorepoFixture(root: string): Promise<void> {
  await writeTree(root, pnpmMonorepoTree());
}

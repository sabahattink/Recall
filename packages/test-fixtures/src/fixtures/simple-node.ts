import { writeTree, type FileTree } from '../write-tree.js';

export function simpleNodeTree(): FileTree {
  return {
    'package.json': JSON.stringify(
      {
        name: 'simple-node-fixture',
        version: '1.0.0',
        private: true,
        description: 'A minimal generic Node.js project used as a Recall test fixture.',
        main: 'src/index.js',
        engines: { node: '>=20' },
        scripts: {
          start: 'node src/index.js',
          test: 'node --test',
        },
        dependencies: {
          express: '^4.21.0',
        },
        devDependencies: {},
      },
      null,
      2,
    ),
    '.gitignore': 'node_modules/\ndist/\n.env\n',
    'src/index.js': [
      "const express = require('express');",
      "const { createUser } = require('./users/create-user');",
      '',
      'const app = express();',
      "app.get('/health', (req, res) => res.json({ ok: true }));",
      "app.post('/users', (req, res) => res.json(createUser(req.body)));",
      '',
      'module.exports = app;',
      '',
    ].join('\n'),
    'src/users/create-user.js': [
      'function createUser(input) {',
      '  return { id: 1, name: input.name };',
      '}',
      '',
      'module.exports = { createUser };',
      '',
    ].join('\n'),
    'src/users/create-user.test.js': [
      "const test = require('node:test');",
      "const assert = require('node:assert');",
      "const { createUser } = require('./create-user');",
      '',
      "test('creates a user', () => {",
      "  assert.deepEqual(createUser({ name: 'Ada' }), { id: 1, name: 'Ada' });",
      '});',
      '',
    ].join('\n'),
    'README.md':
      '# simple-node-fixture\n\nA minimal Node.js project for Recall integration tests.\n',
  };
}

export async function buildSimpleNodeFixture(root: string): Promise<void> {
  await writeTree(root, simpleNodeTree());
}

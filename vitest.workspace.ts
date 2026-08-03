import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/schemas',
  'packages/git',
  'packages/analyzers',
  'packages/memory',
  'packages/core',
  'packages/test-fixtures',
  'apps/cli',
]);

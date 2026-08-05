import { writeTree, type FileTree } from '../write-tree.js';

/**
 * A small, realistic project shaped specifically to exercise task-focused
 * ranking end-to-end: a CLI command, a core use case, a ranking/renderer
 * module, their tests, unrelated auth/billing code, a CI packaging script
 * and workflow, a config file, and a fixtures/ directory — so ranking tests
 * can assert both "the right files surface" and "the wrong files don't",
 * against real scanned/ranked output rather than a hand-built snapshot.
 */
export function taskRankingTree(): FileTree {
  return {
    'package.json': JSON.stringify(
      {
        name: 'task-ranking-fixture',
        version: '1.0.0',
        private: true,
        description: 'Fixture project for Recall task-focused ranking regression tests.',
        main: 'dist/index.js',
        scripts: {
          build: 'tsc -b',
          test: 'vitest run',
          lint: 'eslint src',
          release: 'node scripts/package-release.mjs',
        },
        dependencies: {},
        devDependencies: { typescript: '^5.0.0', vitest: '^2.0.0' },
      },
      null,
      2,
    ),
    'tsconfig.json': JSON.stringify(
      { compilerOptions: { target: 'ES2022', module: 'NodeNext', strict: true } },
      null,
      2,
    ),
    'package-lock.json': JSON.stringify(
      { name: 'task-ranking-fixture', version: '1.0.0', lockfileVersion: 3 },
      null,
      2,
    ),
    // Registers apps/* and packages/* as real workspaces, so workspace-scoped
    // signals (workspace-match, workspace-locality) have something to test
    // against — without this, every file below would share a single
    // (root-only) workspace and those signals could never meaningfully fire.
    'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n",

    // --- Windows npm packaging shebang (Sprint 2.1 precision-test target,
    // shaped after the real apps/cli/scripts/{bundle,bundle-internal,
    // verify-package}.mjs relationship) ---------------------------------
    'apps/cli/package.json': JSON.stringify(
      {
        name: 'cli-fixture',
        version: '1.0.0',
        private: true,
        scripts: { bundle: 'node scripts/bundle.mjs' },
        dependencies: {},
        devDependencies: {},
      },
      null,
      2,
    ),
    'apps/cli/scripts/bundle-internal.mjs': [
      "export const CANONICAL_SHEBANG = '#!/usr/bin/env node';",
      '',
      'export function normalizeShebang(source) {',
      '  return source;',
      '}',
      '',
    ].join('\n'),
    'apps/cli/scripts/bundle.mjs': [
      "import { normalizeShebang } from './bundle-internal.mjs';",
      '',
      'export function bundle(source) {',
      '  return normalizeShebang(source);',
      '}',
      '',
    ].join('\n'),
    'apps/cli/scripts/verify-package.mjs': [
      "import { CANONICAL_SHEBANG } from './bundle-internal.mjs';",
      '',
      'export function verifyPackage(source) {',
      '  return source.startsWith(CANONICAL_SHEBANG);',
      '}',
      '',
    ].join('\n'),
    'apps/cli/scripts/__tests__/bundle-internal.test.mjs': [
      "import { describe, expect, it } from 'vitest';",
      "import { normalizeShebang } from '../bundle-internal.mjs';",
      '',
      "describe('normalizeShebang', () => {",
      "  it('is a function', () => {",
      "    expect(typeof normalizeShebang).toBe('function');",
      '  });',
      '});',
      '',
    ].join('\n'),
    'apps/cli/src/__tests__/packaging.test.ts': [
      "import { describe, expect, it } from 'vitest';",
      '',
      "describe('packaging', () => {",
      "  it('produces a valid package', () => {",
      '    expect(true).toBe(true);',
      '  });',
      '});',
      '',
    ].join('\n'),

    // --- Extra sibling package.json files, to create realistic "many
    // workspace package.json files" crowding for the generic-term-precision
    // tests, without being relevant to any task above. --------------------
    'packages/alpha/package.json': JSON.stringify(
      { name: 'alpha-fixture', version: '1.0.0', private: true },
      null,
      2,
    ),
    'packages/alpha/src/index.ts': 'export const alpha = 1;\n',
    'packages/beta/package.json': JSON.stringify(
      { name: 'beta-fixture', version: '1.0.0', private: true },
      null,
      2,
    ),
    'packages/beta/src/index.ts': 'export const beta = 1;\n',
    'packages/gamma/package.json': JSON.stringify(
      { name: 'gamma-fixture', version: '1.0.0', private: true },
      null,
      2,
    ),
    'packages/gamma/src/index.ts': 'export const gamma = 1;\n',

    // --- CI packaging (task C target) ---------------------------------
    '.github/workflows/ci.yml': [
      'name: CI',
      'on: [push]',
      'jobs:',
      '  build:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - run: npm run build',
      '      - run: npm run test',
      '',
    ].join('\n'),
    'scripts/package-release.mjs': [
      '#!/usr/bin/env node',
      '// Packages the CLI for release.',
      'export function packageRelease() {',
      "  console.log('packaging release');",
      '}',
      '',
    ].join('\n'),
    'scripts/__tests__/package-release.test.ts': [
      "import { describe, expect, it } from 'vitest';",
      "import { packageRelease } from '../package-release.mjs';",
      '',
      "describe('packageRelease', () => {",
      "  it('runs without throwing', () => {",
      '    expect(() => packageRelease()).not.toThrow();',
      '  });',
      '});',
      '',
    ].join('\n'),

    // --- Context/ranking implementation (task A target) ---------------
    'src/cli/commands/context-command.ts': [
      "import { runContextUseCase } from '../../core/context-use-case.js';",
      '',
      'export async function contextCommand(task) {',
      '  return runContextUseCase(task);',
      '}',
      '',
    ].join('\n'),
    'src/cli/commands/__tests__/context-command.test.ts': [
      "import { describe, expect, it } from 'vitest';",
      "import { contextCommand } from '../context-command.js';",
      '',
      "describe('contextCommand', () => {",
      "  it('delegates to the use case', async () => {",
      "    expect(typeof contextCommand).toBe('function');",
      '  });',
      '});',
      '',
    ].join('\n'),
    'src/core/context-use-case.ts': [
      "import { rankFilesForTask } from './context-ranker.js';",
      '',
      'export function runContextUseCase(task) {',
      '  return rankFilesForTask(task);',
      '}',
      '',
    ].join('\n'),
    'src/core/__tests__/context-use-case.test.ts': [
      "import { describe, expect, it } from 'vitest';",
      "import { runContextUseCase } from '../context-use-case.js';",
      '',
      "describe('runContextUseCase', () => {",
      "  it('is a function', () => {",
      "    expect(typeof runContextUseCase).toBe('function');",
      '  });',
      '});',
      '',
    ].join('\n'),
    'src/core/context-ranker.ts': [
      'export function rankFilesForTask(task) {',
      '  return [];',
      '}',
      '',
    ].join('\n'),
    'src/core/__tests__/context-ranker.test.ts': [
      "import { describe, expect, it } from 'vitest';",
      "import { rankFilesForTask } from '../context-ranker.js';",
      '',
      "describe('rankFilesForTask', () => {",
      "  it('returns an array', () => {",
      "    expect(Array.isArray(rankFilesForTask('x'))).toBe(true);",
      '  });',
      '});',
      '',
    ].join('\n'),

    // --- Password reset (task B target) --------------------------------
    'src/auth/password-reset.controller.ts': [
      "import { PasswordResetService } from './password-reset.service.js';",
      '',
      'export class PasswordResetController {',
      '  constructor(service) { this.service = service; }',
      '  reset(dto) { return this.service.reset(dto); }',
      '}',
      '',
    ].join('\n'),
    'src/auth/password-reset.service.ts': [
      'export class PasswordResetService {',
      '  reset(dto) { return { ok: true }; }',
      '}',
      '',
    ].join('\n'),
    'src/auth/password-reset.module.ts': [
      "import { PasswordResetController } from './password-reset.controller.js';",
      "import { PasswordResetService } from './password-reset.service.js';",
      '',
      'export class PasswordResetModule {',
      '  controllers = [PasswordResetController];',
      '  providers = [PasswordResetService];',
      '}',
      '',
    ].join('\n'),
    'src/auth/dto/reset-password.dto.ts': [
      'export class ResetPasswordDto {',
      '  token;',
      '  newPassword;',
      '}',
      '',
    ].join('\n'),
    'src/auth/__tests__/password-reset.controller.test.ts': [
      "import { describe, expect, it } from 'vitest';",
      "import { PasswordResetController } from '../password-reset.controller.js';",
      '',
      "describe('PasswordResetController', () => {",
      "  it('delegates to the service', () => {",
      '    const service = { reset: () => ({ ok: true }) };',
      '    const controller = new PasswordResetController(service);',
      '    expect(controller.reset({})).toEqual({ ok: true });',
      '  });',
      '});',
      '',
    ].join('\n'),
    'src/auth/__tests__/password-reset.service.test.ts': [
      "import { describe, expect, it } from 'vitest';",
      "import { PasswordResetService } from '../password-reset.service.js';",
      '',
      "describe('PasswordResetService', () => {",
      "  it('resets', () => {",
      '    expect(new PasswordResetService().reset({})).toEqual({ ok: true });',
      '  });',
      '});',
      '',
    ].join('\n'),

    // --- Unrelated code (must not crowd out the targets above). Deliberately
    // avoids generic architectural suffixes ("controller"/"service") that
    // would coincidentally collide with task B's vocabulary — the point is
    // to test true irrelevance, not term ambiguity. ------------------------
    'src/billing/invoice-generator.ts': [
      'export class InvoiceGenerator {',
      '  charge(amount) { return { charged: amount }; }',
      '}',
      '',
    ].join('\n'),
    'src/billing/payment-processor.ts': [
      'export class PaymentProcessor {',
      '  invoice(amount) { return { total: amount }; }',
      '}',
      '',
    ].join('\n'),
    'src/misc/logger.ts': [
      'export function log(message) {',
      '  console.log(message);',
      '}',
      '',
    ].join('\n'),

    // --- Fixtures directory (excluded unless the task mentions it) -----
    'fixtures/sample-project/index.ts': "export const sample = 'context ranking password reset';\n",

    '.gitignore': 'node_modules/\ndist/\n',
  };
}

export async function buildTaskRankingFixture(root: string): Promise<void> {
  await writeTree(root, taskRankingTree());
}

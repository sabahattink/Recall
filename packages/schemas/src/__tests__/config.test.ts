import { describe, expect, it } from 'vitest';
import { shouldAnalyzePath } from '../config.js';

describe('shouldAnalyzePath', () => {
  it('excludes default fixture/example/generated/vendor noise', () => {
    for (const path of [
      'packages/test-fixtures/fixtures/app/src/index.ts',
      'src/__fixtures__/auth/user.ts',
      'fixtures/demo/index.ts',
      'src/__mocks__/client.ts',
      'examples/basic/index.ts',
      'generated/api/client.ts',
      'vendor/library/index.ts',
      'vendored/library/index.ts',
    ]) {
      expect(shouldAnalyzePath(path)).toBe(false);
    }
  });

  it('allows an explicit include to override default and user ignores', () => {
    expect(
      shouldAnalyzePath('examples/reference/controller.ts', {
        ignore: ['examples/**'],
        include: ['examples/reference/**'],
      }),
    ).toBe(true);
  });

  it('applies user ignore globs while leaving ordinary source paths enabled', () => {
    const config = { ignore: ['src/legacy/**'], include: [] };
    expect(shouldAnalyzePath('src/legacy/old.ts', config)).toBe(false);
    expect(shouldAnalyzePath('src/current/new.ts', config)).toBe(true);
  });

  it('excludes generated-kind files unless explicitly included', () => {
    expect(shouldAnalyzePath('src/client.ts', { ignore: [], include: [] }, 'generated')).toBe(false);
    expect(
      shouldAnalyzePath(
        'src/client.ts',
        { ignore: [], include: ['src/client.ts'] },
        'generated',
      ),
    ).toBe(true);
  });
});

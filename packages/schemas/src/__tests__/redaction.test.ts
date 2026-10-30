import { describe, expect, it } from 'vitest';
import { REDACTED, redactSecrets, stripUrlCredentials } from '../redaction.js';

describe('stripUrlCredentials', () => {
  it.each([
    ['https://x-access-token:ghp_abc@github.com/o/r.git', 'https://github.com/o/r.git'],
    ['https://ghp_abc@github.com/o/r.git', 'https://github.com/o/r.git'],
    ['git+https://user:tok@github.com/o/r.git#v1', 'git+https://github.com/o/r.git#v1'],
    ['ssh://git:pw@github.com/o/r.git', 'ssh://git@github.com/o/r.git'],
    ['ssh://git@github.com/o/r.git', 'ssh://git@github.com/o/r.git'],
    ['git@github.com:o/r.git', 'git@github.com:o/r.git'],
    ['https://github.com/o/r.git', 'https://github.com/o/r.git'],
    ['^1.2.3', '^1.2.3'],
  ])('%s → %s', (input, expected) => {
    expect(stripUrlCredentials(input)).toBe(expected);
  });

  it('strips every URL in a longer string, and URLs whose password breaks URL parsing', () => {
    expect(stripUrlCredentials('curl https://a:b@x.io/1 && curl http://user:p#ss@y.io/2')).toBe(
      'curl https://x.io/1 && curl http://y.io/2',
    );
  });
});

describe('redactSecrets', () => {
  it('redacts secret-named environment assignments in a script body', () => {
    expect(redactSecrets('cross-env API_KEY=abc123 NODE_ENV=test node x.js')).toBe(
      `cross-env API_KEY=${REDACTED} NODE_ENV=test node x.js`,
    );
    expect(redactSecrets('GITHUB_TOKEN="ghp_x y" DB_PASSWORD=\'p w\' run')).toBe(
      `GITHUB_TOKEN=${REDACTED} DB_PASSWORD=${REDACTED} run`,
    );
  });

  it('leaves ordinary scripts untouched', () => {
    expect(redactSecrets('vitest run --reporter=dot')).toBe('vitest run --reporter=dot');
    expect(redactSecrets('turbo run build --filter=web')).toBe('turbo run build --filter=web');
  });
});

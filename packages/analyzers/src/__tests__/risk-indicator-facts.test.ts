import { describe, expect, it } from 'vitest';
import { FactCollectionSchema, type Fact } from '@recall-ai/schemas';
import { detectRiskIndicatorFacts, type RiskIndicatorInput } from '../risk-indicator-facts.js';
import type { WalkedFile } from '../file-walk.js';

function file(path: string): WalkedFile {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  return { path, sizeBytes: 0, extension: dot > slash ? path.slice(dot) : '' };
}

/** A healthy repository: source, tests, CI, a license, and a lockfile. */
const HEALTHY = [
  'src/index.ts',
  'src/index.test.ts',
  '.github/workflows/ci.yml',
  'LICENSE',
  'package.json',
  'pnpm-lock.yaml',
];
const HEALTHY_FACTS: Fact[] = [
  {
    category: 'package-manager',
    value: 'pnpm',
    evidence: [{ path: 'pnpm-lock.yaml', reason: 'x' }],
  },
];

function detect(overrides: Partial<RiskIndicatorInput> = {}) {
  return detectRiskIndicatorFacts({
    files: HEALTHY.map(file),
    facts: HEALTHY_FACTS,
    truncated: false,
    maxFiles: 20_000,
    ...overrides,
  });
}

function ids(input: Partial<RiskIndicatorInput>) {
  return detect(input).map((fact) => fact.value.id);
}

function withoutFile(path: string): WalkedFile[] {
  return HEALTHY.filter((p) => p !== path).map(file);
}

describe('detectRiskIndicatorFacts', () => {
  it('reports nothing for a healthy repository', () => {
    expect(detect()).toEqual([]);
  });

  it('reports a missing CI configuration, citing the absence', () => {
    const facts = detect({ files: withoutFile('.github/workflows/ci.yml') });
    expect(facts).toHaveLength(1);
    expect(facts[0]?.value.id).toBe('no-ci-configuration');
    expect(facts[0]?.evidence[0]?.path).toBe('.');
    expect(FactCollectionSchema.safeParse(facts).success).toBe(true);
  });

  it.each(['.gitlab-ci.yml', '.circleci/config.yml', 'azure-pipelines.yml', 'Jenkinsfile'])(
    'accepts %s as CI configuration',
    (ciPath) => {
      expect(ids({ files: [...withoutFile('.github/workflows/ci.yml'), file(ciPath)] })).toEqual(
        [],
      );
    },
  );

  it('reports a declared test framework with no test files, citing the declaration', () => {
    const facts = detect({
      files: withoutFile('src/index.test.ts'),
      facts: [
        ...HEALTHY_FACTS,
        {
          category: 'testing-framework',
          value: 'vitest',
          evidence: [{ path: 'package.json', reason: 'dependency "vitest" declared' }],
        },
      ],
    });
    expect(facts.map((f) => f.value.id)).toEqual(['no-test-files']);
    expect(facts[0]?.evidence.map((e) => e.path)).toEqual(['package.json', '.']);
  });

  it('does not report missing tests when no test framework is declared', () => {
    expect(ids({ files: withoutFile('src/index.test.ts') })).toEqual([]);
  });

  it('reports a missing root license, but not one nested in a subdirectory', () => {
    expect(ids({ files: withoutFile('LICENSE') })).toEqual(['no-license']);
    expect(ids({ files: [...withoutFile('LICENSE'), file('docs/LICENSE')] })).toEqual([
      'no-license',
    ]);
    expect(ids({ files: [...withoutFile('LICENSE'), file('LICENSE.md')] })).toEqual([]);
  });

  it('reports package.json without a JavaScript lockfile, even when the manager is known', () => {
    expect(ids({ files: withoutFile('pnpm-lock.yaml') })).toEqual(['no-lockfile']);
    expect(ids({ files: [...withoutFile('pnpm-lock.yaml'), file('yarn.lock')] })).toEqual([]);
  });

  it('reports env files that survived .gitignore, but not template variants, and never reads them', () => {
    const facts = detect({
      files: [
        ...HEALTHY.map(file),
        file('.env'),
        file('apps/api/.env.local'),
        file('.env.example'),
      ],
    });
    expect(facts.map((f) => f.value.id)).toEqual(['env-file-not-ignored']);
    expect(facts[0]?.evidence.map((e) => e.path)).toEqual(['.env', 'apps/api/.env.local']);
  });

  it('turns a truncated walk into an explicit file-limit risk, never a silent gap', () => {
    const facts = detect({ truncated: true, maxFiles: 100 });
    expect(facts.map((f) => f.value.id)).toEqual(['file-limit-reached']);
    expect(facts[0]?.value.description).toContain('100');
  });

  it('reports only the file limit for a repository with no source files', () => {
    expect(ids({ files: [file('README.md')], facts: [] })).toEqual([]);
    expect(ids({ files: [], facts: [], truncated: true })).toEqual(['file-limit-reached']);
  });

  it('emits risks in a fixed order', () => {
    expect(
      ids({ files: [file('src/index.ts'), file('package.json'), file('.env')], facts: [] }),
    ).toEqual(['no-ci-configuration', 'no-license', 'no-lockfile', 'env-file-not-ignored']);
  });
});

import { describe, expect, it } from 'vitest';
import { FactCollectionSchema } from '@recall-ai/schemas';
import { detectLanguageFacts, detectPackageManagerFacts } from '../language-facts.js';
import type { WalkedFile } from '../file-walk.js';

function file(path: string, extension: string): WalkedFile {
  return { path, sizeBytes: 0, extension };
}

describe('detectLanguageFacts', () => {
  it('detects TypeScript from tsconfig.json and cites it as evidence', () => {
    const facts = detectLanguageFacts([file('tsconfig.json', '.json')]);
    expect(facts).toEqual([
      {
        category: 'language',
        value: 'TypeScript',
        evidence: [{ path: 'tsconfig.json', reason: 'tsconfig.json present' }],
      },
    ]);
  });

  it('falls back to a source file when no manifest is present', () => {
    const facts = detectLanguageFacts([file('src/index.ts', '.ts')]);
    expect(facts).toEqual([
      {
        category: 'language',
        value: 'TypeScript',
        evidence: [{ path: 'src/index.ts', reason: '.ts source file present' }],
      },
    ]);
  });

  it('prefers the manifest over a source file when both are present', () => {
    const facts = detectLanguageFacts([
      file('tsconfig.json', '.json'),
      file('src/index.ts', '.ts'),
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.evidence).toEqual([
      { path: 'tsconfig.json', reason: 'tsconfig.json present' },
    ]);
  });

  it('detects Python from requirements.txt', () => {
    const facts = detectLanguageFacts([file('requirements.txt', '')]);
    expect(facts).toEqual([
      {
        category: 'language',
        value: 'Python',
        evidence: [{ path: 'requirements.txt', reason: 'requirements.txt present' }],
      },
    ]);
  });

  it('detects Go from go.mod', () => {
    const facts = detectLanguageFacts([file('go.mod', '')]);
    expect(facts.map((f) => f.value)).toEqual(['Go']);
  });

  it('detects Rust from Cargo.toml', () => {
    const facts = detectLanguageFacts([file('Cargo.toml', '')]);
    expect(facts.map((f) => f.value)).toEqual(['Rust']);
  });

  it('produces no fact, and no error, when a repository has no evidence for any known language', () => {
    const facts = detectLanguageFacts([file('README.md', '.md')]);
    expect(facts).toEqual([]);
  });

  it('detects multiple languages in a fixed, deterministic order regardless of input order', () => {
    const facts = detectLanguageFacts([
      file('Cargo.toml', ''),
      file('go.mod', ''),
      file('tsconfig.json', '.json'),
    ]);
    expect(facts.map((f) => f.value)).toEqual(['TypeScript', 'Go', 'Rust']);
  });

  it('emits Facts that conform to the frozen Fact schema', () => {
    const facts = detectLanguageFacts([
      file('tsconfig.json', '.json'),
      file('requirements.txt', ''),
    ]);
    const result = FactCollectionSchema.safeParse(facts);
    expect(result.success).toBe(true);
    expect(facts.every((f) => f.evidence.length >= 1)).toBe(true);
  });
});

describe('detectPackageManagerFacts', () => {
  it('detects pnpm from pnpm-lock.yaml', () => {
    const facts = detectPackageManagerFacts([file('pnpm-lock.yaml', '.yaml')]);
    expect(facts).toEqual([
      {
        category: 'package-manager',
        value: 'pnpm',
        evidence: [{ path: 'pnpm-lock.yaml', reason: 'pnpm-lock.yaml present' }],
      },
    ]);
  });

  it('detects npm from package-lock.json', () => {
    const facts = detectPackageManagerFacts([file('package-lock.json', '.json')]);
    expect(facts.map((f) => f.value)).toEqual(['npm']);
  });

  it('detects yarn from yarn.lock', () => {
    const facts = detectPackageManagerFacts([file('yarn.lock', '')]);
    expect(facts.map((f) => f.value)).toEqual(['yarn']);
  });

  it('detects pip from requirements.txt', () => {
    const facts = detectPackageManagerFacts([file('requirements.txt', '')]);
    expect(facts.map((f) => f.value)).toEqual(['pip']);
  });

  it('detects poetry from pyproject.toml', () => {
    const facts = detectPackageManagerFacts([file('pyproject.toml', '')]);
    expect(facts.map((f) => f.value)).toEqual(['poetry']);
  });

  it('detects go-modules from go.mod', () => {
    const facts = detectPackageManagerFacts([file('go.mod', '')]);
    expect(facts.map((f) => f.value)).toEqual(['go-modules']);
  });

  it('detects cargo from Cargo.toml', () => {
    const facts = detectPackageManagerFacts([file('Cargo.toml', '')]);
    expect(facts.map((f) => f.value)).toEqual(['cargo']);
  });

  it('produces no fact, and no error, when no known lockfile is present', () => {
    const facts = detectPackageManagerFacts([file('README.md', '.md')]);
    expect(facts).toEqual([]);
  });

  it('detects multiple package managers in a fixed, deterministic order regardless of input order', () => {
    const facts = detectPackageManagerFacts([
      file('Cargo.toml', ''),
      file('pnpm-lock.yaml', '.yaml'),
      file('go.mod', ''),
    ]);
    expect(facts.map((f) => f.value)).toEqual(['pnpm', 'go-modules', 'cargo']);
  });

  it('emits Facts that conform to the frozen Fact schema', () => {
    const facts = detectPackageManagerFacts([file('pnpm-lock.yaml', '.yaml'), file('go.mod', '')]);
    const result = FactCollectionSchema.safeParse(facts);
    expect(result.success).toBe(true);
    expect(facts.every((f) => f.evidence.length >= 1)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { FactCategorySchema, FactCollectionSchema, FactSchema } from '../fact.js';

const EXPECTED_CATEGORIES = [
  'language',
  'framework',
  'package-manager',
  'workspace-layout',
  'directory',
  'command',
  'testing-framework',
  'linting',
  'architecture-hint',
  'dependency',
  'repository-metadata',
  'risk-indicator',
];

function validFact() {
  return {
    category: 'language',
    value: 'TypeScript',
    evidence: [{ path: 'tsconfig.json', reason: 'TypeScript project configuration present' }],
  };
}

describe('FactCategorySchema', () => {
  it('contains exactly the twelve categories defined by the specification, no more, no fewer', () => {
    expect(FactCategorySchema.options).toEqual(EXPECTED_CATEGORIES);
  });

  it('rejects a category not in the specification', () => {
    const result = FactCategorySchema.safeParse('vibe-check');
    expect(result.success).toBe(false);
  });
});

describe('FactSchema', () => {
  it('accepts a well-formed fact with at least one piece of evidence', () => {
    const result = FactSchema.safeParse(validFact());
    expect(result.success).toBe(true);
  });

  it('rejects a fact with no evidence', () => {
    const fact = { ...validFact(), evidence: [] };
    const result = FactSchema.safeParse(fact);
    expect(result.success).toBe(false);
  });

  it('rejects a fact missing the evidence field entirely', () => {
    const fact = validFact();
    // @ts-expect-error intentionally malformed for the test
    delete fact.evidence;
    const result = FactSchema.safeParse(fact);
    expect(result.success).toBe(false);
  });

  it('rejects a fact with an unrecognized category', () => {
    const fact = { ...validFact(), category: 'vibe-check' };
    const result = FactSchema.safeParse(fact);
    expect(result.success).toBe(false);
  });

  it('accepts a well-formed fact for every defined category', () => {
    for (const category of EXPECTED_CATEGORIES) {
      const result = FactSchema.safeParse({ ...validFact(), category });
      expect(result.success).toBe(true);
    }
  });
});

describe('FactCollectionSchema', () => {
  it('accepts an array of well-formed facts', () => {
    const result = FactCollectionSchema.safeParse([validFact(), validFact()]);
    expect(result.success).toBe(true);
  });

  it('accepts an empty collection', () => {
    const result = FactCollectionSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('rejects a collection containing one malformed fact', () => {
    const result = FactCollectionSchema.safeParse([validFact(), { ...validFact(), evidence: [] }]);
    expect(result.success).toBe(false);
  });
});

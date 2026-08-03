import { describe, expect, it } from 'vitest';
import { NoopInferenceProvider } from '../provider.js';
import { makeSnapshot } from './snapshot-helper.js';

describe('NoopInferenceProvider', () => {
  it('summarizes without making any network calls, returning low confidence', async () => {
    const provider = new NoopInferenceProvider();
    const result = await provider.summarize({ snapshot: makeSnapshot() });
    expect(result.confidence).toBe('low');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('classifies decisions as unconfirmed by default', async () => {
    const provider = new NoopInferenceProvider();
    const result = await provider.classifyDecision({
      snapshot: makeSnapshot(),
      candidateDescription: 'Uses PostgreSQL',
    });
    expect(result.isLikelyIntentional).toBe(false);
  });
});

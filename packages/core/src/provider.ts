import type { RepositorySnapshot } from '@recall-ai/schemas';

export interface SummarizeInput {
  snapshot: RepositorySnapshot;
  focusPath?: string;
}

export interface SummarizeResult {
  summary: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface ClassifyDecisionInput {
  snapshot: RepositorySnapshot;
  candidateDescription: string;
}

export interface ClassifyDecisionResult {
  isLikelyIntentional: boolean;
  rationale: string;
}

/**
 * Optional hook for AI-assisted enrichment. Recall's core commands
 * (init/scan/update/status/explain/context/doctor) never require an
 * implementation of this interface to produce complete, correct output —
 * every one of them works fully offline against deterministic analysis. A
 * provider can be plugged in later (OpenAI, Anthropic, a local
 * Ollama-compatible endpoint — see docs/provider-interface.md) to add prose
 * summarization on top of the same evidence, never in place of it.
 */
export interface RecallInferenceProvider {
  readonly name: string;
  summarize(input: SummarizeInput): Promise<SummarizeResult>;
  classifyDecision(input: ClassifyDecisionInput): Promise<ClassifyDecisionResult>;
}

/** The default provider: makes no network calls and adds no non-deterministic content. */
export class NoopInferenceProvider implements RecallInferenceProvider {
  readonly name = 'noop';

  async summarize(_input: SummarizeInput): Promise<SummarizeResult> {
    return {
      summary:
        'AI-assisted summarization is not enabled. Configure a RecallInferenceProvider to use this feature.',
      confidence: 'low',
    };
  }

  async classifyDecision(_input: ClassifyDecisionInput): Promise<ClassifyDecisionResult> {
    return {
      isLikelyIntentional: false,
      rationale: 'AI-assisted classification is not enabled; this candidate is unconfirmed.',
    };
  }
}

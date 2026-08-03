# Provider interface

Recall's core commands never require an AI provider. Every command — `init`, `scan`, `update`, `status`, `explain`, `context`, `doctor` — produces complete, correct output using only deterministic, evidence-based analysis. The provider interface exists so that _optional_, clearly-labeled AI-assisted enrichment can be layered on top later, without ever becoming a requirement to run Recall.

## The interface

Defined in `packages/core/src/provider.ts`:

```ts
export interface RecallInferenceProvider {
  readonly name: string;
  summarize(input: SummarizeInput): Promise<SummarizeResult>;
  classifyDecision(input: ClassifyDecisionInput): Promise<ClassifyDecisionResult>;
}
```

- `summarize` takes a `RepositorySnapshot` (and an optional `focusPath`) and returns a `{ summary, confidence }` — intended for prose summarization on top of Recall's structured findings, never in place of them.
- `classifyDecision` takes a snapshot and a candidate decision description (the kind of "unconfirmed candidate" text Recall writes into `decisions.md`) and returns `{ isLikelyIntentional, rationale }` — intended to help a human triage candidate decisions faster, not to auto-confirm them.

## The default provider

```ts
export class NoopInferenceProvider implements RecallInferenceProvider {
  readonly name = 'noop';
  async summarize(): Promise<SummarizeResult> {
    return { summary: '...not enabled...', confidence: 'low' };
  }
  async classifyDecision(): Promise<ClassifyDecisionResult> {
    return { isLikelyIntentional: false, rationale: '...not enabled...' };
  }
}
```

`NoopInferenceProvider` is the only provider implemented in this release, and it is the default everywhere the interface is used. It makes no network calls and adds no non-deterministic content to any output.

## How a future adapter would plug in

None of the following are implemented in this release (see [roadmap.md](roadmap.md)); they describe the intended integration shape so a contributor can add one without redesigning the interface.

- **OpenAI** — an adapter would wrap the Chat Completions (or Responses) API, translating a `SummarizeInput`/`ClassifyDecisionInput` into a prompt built from the snapshot's evidence, and mapping the response back into `SummarizeResult`/`ClassifyDecisionResult`. API keys would be read from an environment variable, never from a config file Recall writes.
- **Anthropic** — same shape, targeting the Messages API.
- **Local Ollama-compatible APIs** — same shape, targeting a local HTTP endpoint (e.g. `http://localhost:11434`), which keeps the "no mandatory cloud dependency" property intact even when a provider is configured.

In every case:

- Selecting a provider is an explicit, opt-in configuration step — never automatic.
- A provider failure (network error, missing key, timeout) must never fail a Recall command; it should fall back to the `Noop` behavior and surface the failure only as a warning.
- A provider's output is additive prose/classification on top of deterministic findings, never a replacement for the evidence-based `.recall/` content itself.

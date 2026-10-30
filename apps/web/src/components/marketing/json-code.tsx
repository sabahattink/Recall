import { tokenizeJson, type JsonTokenKind } from '@/lib/json-tokens';

/**
 * Structure (keys, punctuation) recedes; data (strings, numbers, literals)
 * stays at full foreground — design-system.md §8's "the data stands out
 * over the structure", using only the existing two text tokens.
 */
const TOKEN_CLASS: Record<JsonTokenKind, string | undefined> = {
  key: 'text-muted-foreground',
  punctuation: 'text-muted-foreground',
  string: 'text-foreground',
  number: 'text-foreground',
  literal: 'text-foreground',
  whitespace: undefined,
};

/** Server-rendered, syntax-highlighted JSON source text. */
export function JsonCode({ source }: { source: string }) {
  return tokenizeJson(source).map((token, index) => {
    const className = TOKEN_CLASS[token.kind];
    return className ? (
      <span key={index} className={className}>
        {token.text}
      </span>
    ) : (
      token.text
    );
  });
}

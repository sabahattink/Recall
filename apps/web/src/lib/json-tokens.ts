export type JsonTokenKind = 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'whitespace';

export interface JsonToken {
  readonly kind: JsonTokenKind;
  readonly text: string;
}

/**
 * One JSON lexeme per alternative, matched sticky (`y`) so every character
 * of the input is consumed by exactly one token, in order.
 */
const TOKEN_PATTERN =
  /("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)|([{}[\],:])|(\s+)/y;

function isFollowedByColon(source: string, from: number): boolean {
  const rest = source.slice(from);
  return rest.trimStart().startsWith(':');
}

/**
 * Splits JSON source text into display tokens for syntax highlighting.
 * A string immediately followed by `:` is an object key. Concatenating the
 * `text` of every token reproduces the input exactly.
 *
 * @throws Error when the input contains a character no JSON token can start with.
 */
export function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let index = 0;

  while (index < source.length) {
    TOKEN_PATTERN.lastIndex = index;
    const match = TOKEN_PATTERN.exec(source);
    if (!match) {
      throw new Error(`Unexpected character in JSON at offset ${index}`);
    }

    const [text, stringToken, numberToken, literalToken, punctuationToken] = match;
    let kind: JsonTokenKind = 'whitespace';
    if (stringToken !== undefined) {
      kind = isFollowedByColon(source, index + text.length) ? 'key' : 'string';
    } else if (numberToken !== undefined) {
      kind = 'number';
    } else if (literalToken !== undefined) {
      kind = 'literal';
    } else if (punctuationToken !== undefined) {
      kind = 'punctuation';
    }

    tokens.push({ kind, text });
    index += text.length;
  }

  return tokens;
}

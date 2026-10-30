const INDENT = '  ';
const DEFAULT_WIDTH = 80;

type Entry = readonly [key: string | null, value: unknown];

function isContainer(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function entriesOf(value: object): Entry[] {
  return Array.isArray(value)
    ? value.map((item): Entry => [null, item])
    : Object.entries(value).map(([key, item]): Entry => [key, item]);
}

function keyPrefix(key: string | null): string {
  return key === null ? '' : `${JSON.stringify(key)}: `;
}

function formatValue(value: unknown, indent: string, prefixLength: number, width: number): string {
  if (!isContainer(value)) {
    const text = JSON.stringify(value) as string | undefined;
    if (text === undefined) throw new TypeError(`Cannot format ${typeof value} as JSON`);
    return text;
  }

  const isArray = Array.isArray(value);
  const entries = entriesOf(value);
  if (entries.length === 0) return isArray ? '[]' : '{}';

  // A container whose children are all scalars (or empty containers) may sit on one line.
  const isFlat = entries.every(([, item]) => !isContainer(item) || entriesOf(item).length === 0);
  if (isFlat) {
    const parts = entries.map(([key, item]) => keyPrefix(key) + formatValue(item, '', 0, width));
    const inline = isArray ? `[${parts.join(', ')}]` : `{ ${parts.join(', ')} }`;
    // +1 leaves room for a trailing comma after the value.
    if (indent.length + prefixLength + inline.length + 1 <= width) return inline;
  }

  const childIndent = indent + INDENT;
  const lines = entries.map(([key, item]) => {
    const prefix = keyPrefix(key);
    return childIndent + prefix + formatValue(item, childIndent, prefix.length, width);
  });
  const [open, close] = isArray ? ['[', ']'] : ['{', '}'];
  return `${open}\n${lines.join(',\n')}\n${indent}${close}`;
}

/**
 * Pretty-prints a JSON value like `JSON.stringify(value, null, 2)`, except
 * that a container holding only scalars stays on a single line when it fits
 * within `width` columns — so short records such as an evidence entry read
 * as one line. Key order is insertion order; output is deterministic and
 * always valid JSON.
 *
 * @throws TypeError when the value contains something JSON cannot represent.
 */
export function formatJson(value: unknown, width: number = DEFAULT_WIDTH): string {
  return formatValue(value, '', 0, width);
}

/**
 * Markdown building blocks shared by every template. Every value that comes
 * from the repository (names, descriptions, script bodies, paths) passes
 * through one of these before it reaches a file, so repository content can
 * never break the document's structure — a description containing `#`, a
 * newline, or a table pipe stays inside the sentence or cell it belongs to.
 */

/** Collapses all whitespace (including newlines) to single spaces. */
function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Repository text rendered as plain prose, with Markdown control characters
 * escaped — including the ones that only matter at the start of a line,
 * where text such as `- x`, `+ x`, `1. x`, or `===` would otherwise become
 * a list, a numbered list, or a heading underline.
 */
export function text(value: string): string {
  return singleLine(value)
    .replace(/([\\`*_[\]<>|#~])/g, '\\$1')
    .replace(/^([-+=])/, '\\$1')
    .replace(/^(\d+)([.)])/, '$1\\$2');
}

/**
 * Repository text rendered as an inline code span. A value containing
 * backticks gets a longer fence (CommonMark §6.1) so it cannot close the
 * span early.
 */
export function code(value: string): string {
  const content = singleLine(value);
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  const padding = content.startsWith('`') || content.endsWith('`') ? ' ' : '';
  return `${fence}${padding}${content}${padding}${fence}`;
}

/**
 * A document section: a heading plus body lines, omitted entirely when the
 * body has no content. Trailing blank lines are dropped so sections always
 * join with exactly one blank line between them.
 */
export function section(heading: string, body: string[]): string[] {
  let end = body.length;
  while (end > 0 && body[end - 1] === '') end--;
  return end === 0 ? [] : [heading, '', ...body.slice(0, end)];
}

/**
 * Joins blocks of lines with exactly one blank line between non-empty
 * blocks, and ends the document with exactly one `\n` — on every platform.
 */
export function document(blocks: string[][]): string {
  return `${blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join('\n'))
    .join('\n\n')}\n`;
}

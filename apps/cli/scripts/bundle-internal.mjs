#!/usr/bin/env node
// Not part of any published surface — apps/cli's "files" field only ships
// dist/, and package.json's "bin" only ever points at dist/index.js, so
// nothing here is reachable by a consumer of the recall-context package.
// It exists purely as a seam so bundle.mjs's shebang normalization can be
// unit tested directly (see scripts/__tests__/bundle-internal.test.mjs)
// without needing to invoke the real ncc bundler.

export const CANONICAL_SHEBANG = '#!/usr/bin/env node';

const LINE_TERMINATOR = /\r\n|\r|\n/;
const LEADING_LINE_TERMINATORS = /^(?:\r\n|\r|\n)+/;
const BOM = '﻿';

/**
 * Normalizes the very start of a bundled JS file so it begins byte-for-byte
 * with `#!/usr/bin/env node\n` — UTF-8, no BOM, exactly one shebang, no
 * leading blank line — regardless of what the bundler produced.
 *
 * This exists because @vercel/ncc's shebang handling is sensitive to the
 * line endings of the TypeScript source it bundles. On a Windows CI runner
 * with Git's `core.autocrlf=true` (this repository has no .gitattributes
 * forcing LF), the checked-out apps/cli/src/index.ts has CRLF line endings;
 * ncc/terser's minifier then emits the shebang as `#!/usr/bin/env node\r`
 * with no following `\n` at all before the minified code starts, which
 * fails a strict shebang check and would break `node dist/index.js` being
 * invoked as `./dist/index.js` on POSIX systems (the `\r` becomes part of
 * the interpreter path). This function fixes that deterministically after
 * the fact, rather than depending on ncc's internal behavior or on Git
 * checkout line-ending settings.
 *
 * Only the leading shebang boundary is touched; everything else in the
 * bundle is passed through unchanged.
 */
export function normalizeShebang(source) {
  let text = source.startsWith(BOM) ? source.slice(BOM.length) : source;

  // Strip every leading shebang line, however it's terminated — handles a
  // duplicated or malformed one, not just the expected single case.
  while (text.startsWith('#!')) {
    const match = LINE_TERMINATOR.exec(text);
    if (!match || match.index === undefined) {
      // The entire remaining content is a shebang line with no terminator.
      text = '';
      break;
    }
    text = text.slice(match.index + match[0].length);
  }

  // Drop any blank line(s) left behind between the (removed) shebang and
  // the real content, so the canonical shebang is followed immediately by
  // code, not whitespace.
  text = text.replace(LEADING_LINE_TERMINATORS, '');

  return `${CANONICAL_SHEBANG}\n${text}`;
}

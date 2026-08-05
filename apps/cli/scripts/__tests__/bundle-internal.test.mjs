import { describe, expect, it } from 'vitest';
import { CANONICAL_SHEBANG, normalizeShebang } from '../bundle-internal.mjs';

const BOM = '﻿';
const CANONICAL_PREFIX = `${CANONICAL_SHEBANG}\n`;

/**
 * Byte-level check mirroring what verify-package.mjs asserts against the
 * real dist/index.js: exact canonical shebang, immediately followed by a
 * single LF, no BOM, no second shebang anywhere else in the file.
 */
function assertCanonical(output) {
  const buffer = Buffer.from(output, 'utf8');
  expect(buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
  const shebangBytes = Buffer.from(CANONICAL_SHEBANG, 'utf8');
  expect(buffer.subarray(0, shebangBytes.length).equals(shebangBytes)).toBe(true);
  expect(buffer[shebangBytes.length]).toBe(0x0a);
  expect(buffer.subarray(shebangBytes.length + 1).toString('utf8')).not.toContain(
    CANONICAL_SHEBANG,
  );
}

describe('normalizeShebang', () => {
  it('strips a UTF-8 BOM before the shebang', () => {
    const input = `${BOM}${CANONICAL_SHEBANG}\nconsole.log(1);\n`;
    const output = normalizeShebang(input);
    expect(output).toBe(`${CANONICAL_SHEBANG}\nconsole.log(1);\n`);
    assertCanonical(output);
  });

  it('normalizes a CRLF-terminated shebang to LF', () => {
    const input = `${CANONICAL_SHEBANG}\r\nconsole.log(1);\r\n`;
    const output = normalizeShebang(input);
    expect(output.startsWith(CANONICAL_PREFIX)).toBe(true);
    expect(output).toBe(`${CANONICAL_SHEBANG}\nconsole.log(1);\r\n`);
    assertCanonical(output);
  });

  it('normalizes a shebang with a trailing CR and no following LF at all', () => {
    // The exact byte-level bug this module exists to fix: on Windows CI
    // (Git core.autocrlf=true, no .gitattributes forcing LF), @vercel/ncc's
    // minifier can emit "#!/usr/bin/env node\r" directly followed by
    // minified code with no newline separator whatsoever.
    const input = `${CANONICAL_SHEBANG}\rimport*as e from"cac";`;
    const output = normalizeShebang(input);
    expect(output).toBe(`${CANONICAL_SHEBANG}\nimport*as e from"cac";`);
    assertCanonical(output);
  });

  it('does not duplicate an already-correct shebang', () => {
    const input = `${CANONICAL_SHEBANG}\nconsole.log(1);\n`;
    const output = normalizeShebang(input);
    expect(output).toBe(input);
    assertCanonical(output);
  });

  it('collapses a duplicated/malformed leading shebang to exactly one', () => {
    const input = `${CANONICAL_SHEBANG}\n${CANONICAL_SHEBANG}\nconsole.log(1);\n`;
    const output = normalizeShebang(input);
    expect(output).toBe(`${CANONICAL_SHEBANG}\nconsole.log(1);\n`);
    assertCanonical(output);
  });

  it('adds a shebang when the input has none', () => {
    const input = `console.log(1);\n`;
    const output = normalizeShebang(input);
    expect(output).toBe(`${CANONICAL_SHEBANG}\nconsole.log(1);\n`);
    assertCanonical(output);
  });

  it('removes a blank line left between the old shebang and the code', () => {
    const input = `${CANONICAL_SHEBANG}\n\n\nconsole.log(1);\n`;
    const output = normalizeShebang(input);
    expect(output).toBe(`${CANONICAL_SHEBANG}\nconsole.log(1);\n`);
    assertCanonical(output);
  });

  it('leaves a shebang-like string deeper in the file untouched', () => {
    // Only the leading boundary is normalized — a literal occurrence of the
    // shebang text inside the bundled code (e.g. a string constant) is data,
    // not a second shebang, and must not be rewritten.
    const input = `${CANONICAL_SHEBANG}\nconst s = "${CANONICAL_SHEBANG}";\n`;
    const output = normalizeShebang(input);
    expect(output).toBe(input);
  });
});

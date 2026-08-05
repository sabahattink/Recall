#!/usr/bin/env node
// Packaging assertions run as part of `prepack`, right before npm creates
// the tarball. Failing fast here (instead of only discovering a broken
// publish after `npm publish`) is the whole point of a prepack validation
// step. Every check here is about the *published artifact*, not product
// behavior — no product code is exercised.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_SHEBANG } from './bundle-internal.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, '..');

let failures = 0;

function check(label, condition, diagnostics) {
  if (condition) {
    console.log(`ok: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    if (diagnostics) {
      for (const line of diagnostics) console.error(`  ${line}`);
    }
    failures++;
  }
}

const distEntry = join(cliRoot, 'dist', 'index.js');
check('dist/index.js exists', existsSync(distEntry));

if (existsSync(distEntry)) {
  checkShebangBytes(readFileSync(distEntry));
}

const pkg = JSON.parse(readFileSync(join(cliRoot, 'package.json'), 'utf8'));

check('package.json declares a "recall" bin entry', pkg.bin?.recall === 'dist/index.js');
check(
  'the bin target file exists on disk',
  pkg.bin?.recall ? existsSync(join(cliRoot, pkg.bin.recall)) : false,
);

const manifestText = readFileSync(join(cliRoot, 'package.json'), 'utf8');
check('package.json has no "workspace:" references', !manifestText.includes('workspace:'));

if (existsSync(distEntry)) {
  const contents = readFileSync(distEntry, 'utf8');
  check(
    'dist/index.js does not require/import an unpublished @recall-ai/* package',
    !/(?:require\(|from\s*)["']@recall-ai\//.test(contents),
  );
}

/**
 * Verifies dist/index.js's shebang at the raw-byte level, not just via a
 * decoded string comparison — a decoded `startsWith`/`split('\n')[0]===`
 * check can pass on a string that still has a trailing `\r`, a leading BOM,
 * or other bytes a naive text comparison won't reveal but that break the
 * file as an executable on at least one platform.
 */
function checkShebangBytes(buffer) {
  const BOM_BYTES = Buffer.from([0xef, 0xbb, 0xbf]);
  const hasBom = buffer.subarray(0, 3).equals(BOM_BYTES);
  const shebangBytes = Buffer.from(CANONICAL_SHEBANG, 'utf8');
  const bodyStart = (hasBom ? 3 : 0) + shebangBytes.length;

  const firstBytesHex = buffer.subarray(0, 32).toString('hex');
  const firstLineEscaped = JSON.stringify(
    buffer
      .subarray(0, 64)
      .toString('utf8')
      .split(/\r\n|\r|\n/, 1)[0],
  );
  const diagnostics = [
    `first 32 bytes (hex): ${firstBytesHex}`,
    `first line (escaped): ${firstLineEscaped}`,
    `UTF-8 BOM present: ${hasBom}`,
  ];

  check('dist/index.js has no UTF-8 BOM', !hasBom, diagnostics);

  const actualShebangBytes = buffer.subarray(hasBom ? 3 : 0, bodyStart);
  check(
    'dist/index.js begins with the canonical `#!/usr/bin/env node` shebang bytes',
    actualShebangBytes.equals(shebangBytes),
    diagnostics,
  );

  check(
    'the shebang is followed immediately by a single LF byte',
    buffer[bodyStart] === 0x0a,
    diagnostics,
  );

  const rest = buffer.subarray(bodyStart + 1).toString('utf8');
  check(
    'no second shebang appears later in the file',
    !rest.includes(CANONICAL_SHEBANG),
    diagnostics,
  );
}

if (failures > 0) {
  console.error(`\nverify-package.mjs: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-package.mjs: all packaging checks passed');

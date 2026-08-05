#!/usr/bin/env node
// Packaging assertions run as part of `prepack`, right before npm creates
// the tarball. Failing fast here (instead of only discovering a broken
// publish after `npm publish`) is the whole point of a prepack validation
// step. Every check here is about the *published artifact*, not product
// behavior — no product code is exercised.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, '..');

let failures = 0;

function check(label, condition) {
  if (condition) {
    console.log(`ok: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

const distEntry = join(cliRoot, 'dist', 'index.js');
check('dist/index.js exists', existsSync(distEntry));

if (existsSync(distEntry)) {
  const contents = readFileSync(distEntry, 'utf8');
  const firstLine = contents.split('\n', 1)[0];
  check('dist/index.js has a `#!/usr/bin/env node` shebang', firstLine === '#!/usr/bin/env node');
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

if (failures > 0) {
  console.error(`\nverify-package.mjs: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-package.mjs: all packaging checks passed');

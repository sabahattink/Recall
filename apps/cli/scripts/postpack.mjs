#!/usr/bin/env node
// npm lifecycle script: runs automatically after `npm pack`/`npm publish`
// finishes creating the tarball. Undoes prepack.mjs's packing-only mutations
// (stripped devDependencies, copied-in README/LICENSE) by restoring
// package.json from the backup file prepack.mjs wrote, so the working tree
// is left exactly as it was before packing.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, '..');

const pkgPath = join(cliRoot, 'package.json');
const backupPath = join(cliRoot, '.prepack-package.json.bak');

if (existsSync(backupPath)) {
  writeFileSync(pkgPath, readFileSync(backupPath, 'utf8'));
  rmSync(backupPath);
} else {
  console.error('postpack: no prepack backup found; leaving package.json as-is');
}

for (const generated of ['README.md', 'LICENSE']) {
  const path = join(cliRoot, generated);
  if (existsSync(path)) rmSync(path);
}

console.error('postpack: restored package.json and removed copied-in README/LICENSE');

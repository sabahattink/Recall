#!/usr/bin/env node
// Bundles apps/cli/src/index.ts and every internal @recall-ai/* workspace
// package it transitively imports (already compiled to dist/ by `tsc -b`,
// which must run before this script) into a single, self-contained
// apps/cli/dist/index.js. This is what makes the published `recall-context`
// package installable without any of the unpublished @recall-ai/* workspace
// packages present.
//
// Genuine third-party npm dependencies (cac, execa, fast-glob, ignore, yaml,
// zod) are deliberately left external/un-bundled and declared as normal
// "dependencies" in package.json instead: one of them ('ignore') is loaded
// through `createRequire(import.meta.url)` for CJS/ESM interop
// (see packages/analyzers/src/file-walk.ts), which bundlers cannot trace
// statically, so it must stay a real installed dependency rather than being
// inlined.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, '..');
const distDir = join(cliRoot, 'dist');
const tmpOutDir = join(cliRoot, '.bundle-tmp');

const EXTERNAL_PACKAGES = ['cac', 'execa', 'fast-glob', 'ignore', 'yaml', 'zod'];

rmSync(tmpOutDir, { recursive: true, force: true });

// Invoke ncc's JS entry point directly with `node` rather than the OS-specific
// shim in node_modules/.bin (a .CMD file on Windows), which execFileSync
// cannot spawn directly without a shell.
const nccEntry = join(cliRoot, 'node_modules', '@vercel', 'ncc', 'dist', 'ncc', 'cli.js');

const args = [nccEntry, 'build', join(cliRoot, 'src', 'index.ts'), '-o', tmpOutDir, '-q', '-m'];
for (const pkg of EXTERNAL_PACKAGES) {
  args.push('-e', pkg);
}

execFileSync(process.execPath, args, { stdio: 'inherit' });

const bundledEntry = join(tmpOutDir, 'index.js');
if (!existsSync(bundledEntry)) {
  throw new Error(`bundle.mjs: expected ncc output at ${bundledEntry}, but it does not exist`);
}

// Replace dist/ with only the bundled entry point — drop the tsc-emitted
// per-module .js/.d.ts/.map files (already inlined into the bundle) and
// ncc's own stray .d.ts output, so the packed tarball contains exactly one
// runtime file.
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'index.js'), readFileSync(bundledEntry, 'utf8'));
chmodSync(join(distDir, 'index.js'), 0o755);

rmSync(tmpOutDir, { recursive: true, force: true });

console.log('bundle.mjs: wrote self-contained dist/index.js');

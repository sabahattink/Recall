#!/usr/bin/env node
// npm lifecycle script: runs automatically before `npm pack`/`npm publish`
// creates a tarball (not on `npm install` by consumers). Builds the whole
// workspace, bundles the CLI into a self-contained dist/index.js, copies in
// the repo-root README/LICENSE (npm only looks inside the package directory
// being packed, so they must physically exist here), and strips
// devDependencies from the packed package.json — none of them ship to
// consumers, and several are unpublished "workspace:*" packages that would
// otherwise leave that protocol string sitting in the published manifest.
//
// postpack.mjs restores the original package.json afterward from the backup
// file written below, not via `git checkout` — this script may run against
// an uncommitted working tree (e.g. from a test), and `git checkout` would
// silently discard any local edits to package.json in that case.
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(here, '..');
const repoRoot = join(cliRoot, '..', '..');

function run(label, command, args) {
  console.error(`prepack: ${label}`);
  // Redirect the child's stdout to our own stderr (not 'inherit'): `npm pack
  // --json` reads this script's stdout as part of npm's own JSON output, so
  // nothing but npm's JSON may appear there.
  execFileSync(command, args, { cwd: cliRoot, stdio: ['ignore', 2, 2] });
}

// 1. Build the workspace. apps/cli's tsconfig project references pull in
//    every internal package it depends on, so this single `tsc -b` also
//    rebuilds their dist/ output. Invoked via typescript's JS entry point
//    directly (not the node_modules/.bin shim, which is a POSIX shell
//    script on Windows and can't be spawned without a shell).
run('build', process.execPath, [join(cliRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-b']);

// 2. Bundle into a self-contained dist/index.js.
run('bundle', process.execPath, [join(cliRoot, 'scripts', 'bundle.mjs')]);

// 3. Copy in the repo's README/LICENSE so npm includes them.
copyFileSync(join(repoRoot, 'README.md'), join(cliRoot, 'README.md'));
copyFileSync(join(repoRoot, 'LICENSE'), join(cliRoot, 'LICENSE'));

// 4. Back up package.json, then strip devDependencies from the copy that
//    gets packed.
const pkgPath = join(cliRoot, 'package.json');
const backupPath = join(cliRoot, '.prepack-package.json.bak');
const originalManifestText = readFileSync(pkgPath, 'utf8');
writeFileSync(backupPath, originalManifestText);

const pkg = JSON.parse(originalManifestText);
delete pkg.devDependencies;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 5. Verify the result before npm actually creates the tarball.
run('verify:package', process.execPath, [join(cliRoot, 'scripts', 'verify-package.mjs')]);

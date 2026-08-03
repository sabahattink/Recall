#!/usr/bin/env node
// Cross-platform replacement for `rm -rf dist *.tsbuildinfo`, run from within
// a package directory (each package's `clean` script invokes this with its
// own cwd). Plain `rm -rf` isn't available on Windows outside of a POSIX
// shell, so this uses only Node's `fs` module.
import { readdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

for (const entry of readdirSync('.')) {
  if (entry.endsWith('.tsbuildinfo')) {
    rmSync(entry, { force: true });
  }
}

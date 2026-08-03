#!/usr/bin/env node
import { runCli } from './cli.js';

process.on('SIGINT', () => {
  process.stderr.write('\nCancelled.\n');
  process.exit(130);
});

await runCli(process.argv);

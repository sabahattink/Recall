#!/usr/bin/env node
import { runCli } from './cli.js';

process.exitCode = await runCli(process.argv.slice(2), {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
  debug: process.env.RECALL_DEBUG === '1',
});

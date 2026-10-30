#!/usr/bin/env node
// End-to-end CI verification of the compiled CLI against every reference
// fixture (docs/implementation-blueprint.md REL-01/REL-02 and the §6 release
// checklist). Written in plain Node so the same steps run identically on
// ubuntu-latest, macos-latest, and windows-latest.
//
// For each fixture, in a throwaway Git repository under the OS temp dir:
//   1. `recall init` succeeds with exactly the spec §11 stdout and no stderr,
//      under Node's permission model (file writes allowed only inside the
//      repository) and a preload that throws on any network call;
//   2. `.recall/` holds exactly the six files of spec §12;
//   3. nothing outside `.recall/` changed, byte for byte (`.git/` included);
//   4. a second run without --force exits 4 and changes nothing;
//   5. ten consecutive --force runs produce byte-identical output.
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const cliEntry = join(repoRoot, 'apps', 'cli', 'dist', 'index.js');
const noNetworkPreload = join(here, 'no-network.mjs');
const fixturesEntry = join(repoRoot, 'packages', 'test-fixtures', 'dist', 'index.js');

const EXPECTED_STDOUT =
  'Scanning repository...\nDetecting architecture...\nGenerating AI memory...\nDone.\n';
const OUTPUT_CONTRACT = [
  '.recall/agents/claude.md',
  '.recall/agents/codex.md',
  '.recall/agents/cursor.md',
  '.recall/agents/gemini.md',
  '.recall/agents/openai.md',
  '.recall/memory.json',
];
const DETERMINISM_RUNS = 10;
const EXIT_ALREADY_INITIALIZED = 4;

let failures = 0;
let currentFixture = '';

function step(label) {
  console.log(`\n--- ${label} ---`);
}

/** GitHub workflow-command escaping, so a multi-line detail stays one annotation. */
function escapeAnnotation(text) {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/**
 * Logs a check. A failure is also emitted as a GitHub Actions error
 * annotation, which is readable from a pull request's checks (and the
 * public API) without access to the job log.
 */
function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`ok: ${message}`);
    return;
  }
  failures++;
  console.error(`FAIL: ${message}${detail ? `\n${detail}` : ''}`);
  if (process.env.GITHUB_ACTIONS === 'true') {
    const text = `${currentFixture}: ${message}${detail ? `\n${detail}` : ''}`;
    console.log(`::error title=ci-verify::${escapeAnnotation(text)}`);
  }
}

/** Paths added (+), removed (-), or changed (~) between two hashed trees. */
function treeDiff(before, after) {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return paths
    .filter((path) => before[path] !== after[path])
    .map((path) => `${!(path in before) ? '+' : !(path in after) ? '-' : '~'} ${path}`)
    .join('\n');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return result;
}

/**
 * Runs the compiled CLI sandboxed: writes only inside `repo`, no network.
 * Both the given and the real path are allowed, because the CLI writes
 * through `realpath(root)` and temp directories are often reached through
 * a symlink (`/var` → `/private/var` on macOS) or an 8.3 short name on
 * Windows (`C:\Users\RUNNER~1\...`). Only the native realpath expands a
 * short name, and it is the one the CLI uses.
 */
function runCli(args, repo) {
  const result = run(process.execPath, [
    '--experimental-permission',
    '--allow-fs-read=*',
    `--allow-fs-write=${repo}`,
    `--allow-fs-write=${realpathSync.native(repo)}`,
    '--allow-child-process',
    '--no-warnings',
    '--import',
    pathToFileURL(noNetworkPreload).href,
    cliEntry,
    ...args,
  ]);
  return { exitCode: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/** Every file under `dir` → sha256 of its bytes, keyed by sorted `/`-relative path. */
function hashTree(dir, prefix = '') {
  const result = {};
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const path = `${prefix}${entry.name}`;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, hashTree(full, `${path}/`));
    else result[path] = createHash('sha256').update(readFileSync(full)).digest('hex');
  }
  return result;
}

function outside(tree) {
  return Object.fromEntries(Object.entries(tree).filter(([path]) => !path.startsWith('.recall/')));
}

function inside(tree) {
  return Object.fromEntries(Object.entries(tree).filter(([path]) => path.startsWith('.recall/')));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const required of [cliEntry, fixturesEntry]) {
  if (!existsSync(required)) {
    console.error(`Missing ${required}. Run "pnpm build" first.`);
    process.exit(1);
  }
}

const { REFERENCE_FIXTURES } = await import(pathToFileURL(fixturesEntry).href);

for (const fixture of REFERENCE_FIXTURES) {
  currentFixture = fixture.name;
  const repo = mkdtempSync(join(tmpdir(), `recall-ci-${fixture.name}-`));
  try {
    step(`${fixture.name}: build fixture in a fresh Git repository`);
    await fixture.build(repo);
    run('git', ['init', '-q', '-b', 'main', repo]);
    run('git', ['-C', repo, 'add', '-A']);
    // `maintenance.auto=false`: otherwise the commit starts a detached
    // `git maintenance run --auto` that creates and deletes
    // `.git/objects/maintenance.lock` while the tree is being hashed.
    run('git', [
      '-C',
      repo,
      '-c',
      'user.name=Recall CI',
      '-c',
      'user.email=ci@example.com',
      '-c',
      'maintenance.auto=false',
      'commit',
      '-q',
      '-m',
      'initial',
    ]);
    const before = hashTree(repo);

    step(`${fixture.name}: recall init (sandboxed: repo-only writes, no network)`);
    const first = runCli(['init', repo], repo);
    assert(
      first.exitCode === 0,
      `exit code 0 (got ${first.exitCode}; stderr: ${first.stderr.trim()})`,
    );
    assert(
      first.stdout === EXPECTED_STDOUT,
      'stdout is exactly the four lines of spec §11',
      `stdout: ${JSON.stringify(first.stdout)}`,
    );
    assert(first.stderr === '', 'stderr is empty', `stderr: ${first.stderr}`);

    const afterFirst = hashTree(repo);
    assert(
      same(Object.keys(inside(afterFirst)), OUTPUT_CONTRACT),
      '.recall/ holds exactly the six contract files',
      Object.keys(inside(afterFirst)).join('\n'),
    );
    assert(
      same(outside(afterFirst), before),
      'nothing outside .recall/ changed (including .git/)',
      treeDiff(before, outside(afterFirst)),
    );
    const memory = JSON.parse(readFileSync(join(repo, '.recall', 'memory.json'), 'utf8'));
    assert(
      /^[0-9a-f]{40}$/.test(memory.metadata?.commit?.value ?? ''),
      'memory.json records the HEAD commit',
    );

    step(`${fixture.name}: second run without --force`);
    const second = runCli(['init', repo], repo);
    assert(
      second.exitCode === EXIT_ALREADY_INITIALIZED,
      `exit code ${EXIT_ALREADY_INITIALIZED} (got ${second.exitCode})`,
      `stderr: ${second.stderr}`,
    );
    assert(second.stdout === '', 'prints no progress', `stdout: ${JSON.stringify(second.stdout)}`);
    const afterSecond = hashTree(repo);
    assert(
      same(afterSecond, afterFirst),
      'changes nothing on disk',
      treeDiff(afterFirst, afterSecond),
    );

    step(`${fixture.name}: ${DETERMINISM_RUNS} consecutive --force runs`);
    let divergence = '';
    for (let i = 0; i < DETERMINISM_RUNS && !divergence; i++) {
      const forced = runCli(['init', repo, '--force'], repo);
      const afterForced = hashTree(repo);
      if (forced.exitCode !== 0 || !same(afterForced, afterFirst)) {
        divergence = [
          `run ${i + 1}: exit code ${forced.exitCode}`,
          `stderr: ${forced.stderr}`,
          treeDiff(afterFirst, afterForced),
        ].join('\n');
      }
    }
    assert(
      divergence === '',
      'every run exits 0 and reproduces the first run byte for byte',
      divergence,
    );
  } catch (error) {
    assert(false, 'verification threw', error instanceof Error ? error.stack : String(error));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

if (failures > 0) {
  console.error(`\n${failures} verification step(s) failed.`);
  process.exit(1);
}
console.log('\nAll CI verification steps passed.');

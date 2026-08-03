#!/usr/bin/env node
// End-to-end CI verification of the compiled CLI, run against a *copy* of a
// bundled fixture in a real temporary directory (not the in-repo fixture
// path), so this never leaves a diff in the repository itself. Written in
// plain Node so the same steps run identically on ubuntu-latest,
// macos-latest, and windows-latest without separate bash/PowerShell scripts.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const cliEntry = join(repoRoot, 'apps', 'cli', 'dist', 'index.js');
const fixtureSource = join(repoRoot, 'packages', 'test-fixtures', 'fixtures', 'simple-node');

const MEMORY_FILES = [
  'architecture.md',
  'conventions.md',
  'decisions.md',
  'features.md',
  'glossary.md',
  'risks.md',
  'technical-debt.md',
];

let failures = 0;

function step(label) {
  console.log(`\n--- ${label} ---`);
}

function assert(condition, message) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`ok: ${message}`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

function runCli(args, cwd) {
  const result = run(process.execPath, [cliEntry, ...args], { cwd });
  return { exitCode: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/** Joins a POSIX-style relative path (as written in this script) onto `base` correctly on Windows. */
function resolveRelative(base, posixRelativePath) {
  return join(base, ...posixRelativePath.split('/'));
}

if (!existsSync(cliEntry)) {
  console.error(`Compiled CLI not found at ${cliEntry}. Run "pnpm build" first.`);
  process.exit(1);
}

step('Copy fixture into a temporary directory');
const workDir = mkdtempSync(join(tmpdir(), 'recall-ci-'));
cpSync(fixtureSource, workDir, { recursive: true });
console.log(`Working copy: ${workDir}`);

step('Initialize a throwaway Git repository around the copy');
run('git', ['init', '-q', '-b', 'main', workDir]);
run('git', ['-C', workDir, 'config', 'user.email', 'ci@example.com']);
run('git', ['-C', workDir, 'config', 'user.name', 'Recall CI']);
run('git', ['-C', workDir, 'add', '-A']);
run('git', ['-C', workDir, 'commit', '-q', '-m', 'chore: initial commit']);

const trackedSourceFiles = ['src/index.js', 'src/users/create-user.js'];
const originalSourceContents = new Map(
  trackedSourceFiles.map((relativePath) => [
    relativePath,
    readFileSync(resolveRelative(workDir, relativePath), 'utf8'),
  ]),
);

step('recall init (no --dry-run)');
const initResult = runCli(['init', '--path', workDir], workDir);
assert(
  initResult.exitCode === 0,
  `init exits 0 (got ${initResult.exitCode}: ${initResult.stderr})`,
);

const recallDir = join(workDir, '.recall');
assert(existsSync(join(recallDir, 'manifest.json')), '.recall/manifest.json exists');
for (const fileName of MEMORY_FILES) {
  assert(existsSync(join(recallDir, fileName)), `.recall/${fileName} exists`);
}

step('recall status (immediately after init, nothing changed yet)');
const statusResult = runCli(['status', '--path', workDir], workDir);
assert(
  statusResult.exitCode === 0,
  `status exits 0 right after init (got ${statusResult.exitCode}: ${statusResult.stderr})`,
);

step('recall context --stdout');
const contextResult = runCli(['context', '--path', workDir, '--stdout'], workDir);
assert(contextResult.exitCode === 0, `context --stdout exits 0 (got ${contextResult.exitCode})`);
assert(
  contextResult.stdout.includes('# Recall Context'),
  'context --stdout prints the expected header',
);
assert(
  !existsSync(join(recallDir, 'context.md')),
  'context --stdout does not write .recall/context.md',
);

step('recall doctor');
const doctorResult = runCli(['doctor', '--path', workDir], workDir);
assert(doctorResult.exitCode === 0, `doctor exits 0 (got ${doctorResult.exitCode})`);

step('recall update --check (nothing changed yet: must not be stale)');
const checkClean = runCli(['update', '--path', workDir, '--check'], workDir);
assert(
  checkClean.exitCode === 0,
  `update --check exits 0 when nothing changed (got ${checkClean.exitCode})`,
);

step('Add human-authored content to a memory file, outside the generated markers');
const architecturePath = join(recallDir, 'architecture.md');
const HUMAN_MARKER = 'THIS LINE WAS WRITTEN BY A HUMAN AND MUST SURVIVE recall update';
const originalArchitecture = readFileSync(architecturePath, 'utf8');
assert(
  originalArchitecture.includes('## Notes'),
  'architecture.md has a human-editable ## Notes section',
);
writeFileSync(
  architecturePath,
  originalArchitecture.replace('## Notes', `## Notes\n\n${HUMAN_MARKER}`),
  'utf8',
);

step('Modify a tracked source file so the repository has drifted from the snapshot');
const newFilePath = join(workDir, 'src', 'ci-verify-new-file.js');
writeFileSync(newFilePath, 'module.exports = { added: true };\n', 'utf8');
run('git', ['-C', workDir, 'add', '-A']);
run('git', ['-C', workDir, 'commit', '-q', '-m', 'feat: add file for CI verification']);

const manifestPath = join(recallDir, 'manifest.json');
const manifestBeforeCheck = readFileSync(manifestPath, 'utf8');

step('recall update --check (repository has drifted: must report stale)');
const checkStale = runCli(['update', '--path', workDir, '--check'], workDir);
assert(
  checkStale.exitCode === 4,
  `update --check exits 4 once the repository has drifted (got ${checkStale.exitCode})`,
);
assert(
  readFileSync(manifestPath, 'utf8') === manifestBeforeCheck,
  '--check left manifest.json untouched (no snapshot commit was recorded)',
);

step('recall update (apply the refresh)');
const updateResult = runCli(['update', '--path', workDir], workDir);
assert(
  updateResult.exitCode === 0,
  `update exits 0 (got ${updateResult.exitCode}: ${updateResult.stderr})`,
);

step('Verify human-authored Markdown survived the update');
const architectureAfterUpdate = readFileSync(architecturePath, 'utf8');
assert(
  architectureAfterUpdate.includes(HUMAN_MARKER),
  'hand-written content outside the generated markers survived recall update',
);

step('Verify source files were never modified by Recall');
for (const relativePath of trackedSourceFiles) {
  const current = readFileSync(resolveRelative(workDir, relativePath), 'utf8');
  assert(
    current === originalSourceContents.get(relativePath),
    `${relativePath} is byte-identical to its pre-init content`,
  );
}

step('Cleanup');
rmSync(workDir, { recursive: true, force: true });
console.log(`Removed ${workDir}`);

if (failures > 0) {
  console.error(`\n${failures} verification step(s) failed.`);
  process.exit(1);
}
console.log('\nAll CI verification steps passed.');

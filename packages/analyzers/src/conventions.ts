import { access, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { ConventionFinding } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { TEST_FILE_PATTERN, SOURCE_EXTENSIONS } from './constants.js';
import type { DiscoveredWorkspace } from './workspaces.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9.]+)+$/;
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9.]+)+$/;

export async function detectConventions(
  root: string,
  files: WalkedFile[],
  workspaces: DiscoveredWorkspace[],
): Promise<ConventionFinding[]> {
  const findings: ConventionFinding[] = [];
  const sourceFiles = files.filter((f) => SOURCE_EXTENSIONS.has(f.extension));

  findings.push(...detectFileNamingConvention(sourceFiles));
  findings.push(...detectTestNamingConvention(files));
  findings.push(...detectPackageScriptsConvention(workspaces));
  findings.push(...(await detectLintingConvention(root)));
  findings.push(...(await detectFormattingConvention(root)));
  findings.push(...(await detectImportAliasConvention(root, workspaces)));
  findings.push(...detectErrorHandlingConvention(files));

  return findings;
}

function detectFileNamingConvention(sourceFiles: WalkedFile[]): ConventionFinding[] {
  let kebab = 0;
  let camel = 0;
  const kebabExamples: string[] = [];
  const camelExamples: string[] = [];

  for (const file of sourceFiles) {
    const name = basename(file.path);
    if (KEBAB_CASE.test(name) && name.includes('-')) {
      kebab++;
      if (kebabExamples.length < 3) kebabExamples.push(file.path);
    } else if (CAMEL_CASE.test(name) && /[A-Z]/.test(name)) {
      camel++;
      if (camelExamples.length < 3) camelExamples.push(file.path);
    }
  }

  const total = kebab + camel;
  if (total < 3) return [];

  const dominant = kebab >= camel ? 'kebab-case' : 'camelCase';
  const examples = kebab >= camel ? kebabExamples : camelExamples;
  const ratio = Math.max(kebab, camel) / total;

  return [
    {
      category: 'file-naming',
      description: `Source file names predominantly use ${dominant} (${Math.round(ratio * 100)}% of ${total} sampled files).`,
      confidence: ratio > 0.8 ? 'high' : 'medium',
      evidence: examples.map((path) => ({ path, reason: `file name uses ${dominant}` })),
    },
  ];
}

function detectTestNamingConvention(files: WalkedFile[]): ConventionFinding[] {
  const testFiles = files.filter((f) => TEST_FILE_PATTERN.test(f.path));
  if (testFiles.length === 0) return [];

  const specCount = testFiles.filter((f) => f.path.includes('.spec.')).length;
  const testCount = testFiles.filter((f) => f.path.includes('.test.')).length;
  if (specCount === 0 && testCount === 0) return [];

  const dominant = specCount >= testCount ? '.spec.ts' : '.test.ts';
  const examples = testFiles
    .filter((f) => f.path.includes(dominant.replace('.ts', '.')))
    .slice(0, 3);

  return [
    {
      category: 'test-naming',
      description: `Tests predominantly use the "${dominant}" suffix (${Math.max(specCount, testCount)} of ${testFiles.length} test files).`,
      confidence: 'high',
      evidence: examples.map((f) => ({
        path: f.path,
        reason: `test file uses ${dominant} suffix`,
      })),
    },
  ];
}

function detectPackageScriptsConvention(workspaces: DiscoveredWorkspace[]): ConventionFinding[] {
  const scriptCounts = new Map<string, number>();
  for (const workspace of workspaces) {
    for (const scriptName of Object.keys(workspace.info.scripts)) {
      scriptCounts.set(scriptName, (scriptCounts.get(scriptName) ?? 0) + 1);
    }
  }
  const common = [...scriptCounts.entries()]
    .filter(([, count]) => count === workspaces.length && workspaces.length > 0)
    .map(([name]) => name)
    .sort();

  if (common.length === 0) return [];

  return [
    {
      category: 'package-scripts',
      description: `Every workspace package.json defines the same script(s): ${common.join(', ')}.`,
      confidence: 'high',
      evidence: workspaces.map((w) => ({
        path: join(w.info.path, 'package.json').split('\\').join('/'),
        reason: `defines script(s): ${common.filter((s) => s in w.info.scripts).join(', ')}`,
      })),
    },
  ];
}

async function detectLintingConvention(root: string): Promise<ConventionFinding[]> {
  const candidates = [
    'eslint.config.js',
    'eslint.config.mjs',
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc',
  ];
  for (const file of candidates) {
    if (await exists(join(root, file))) {
      return [
        {
          category: 'linting',
          description: `ESLint is configured via "${file}".`,
          confidence: 'high',
          evidence: [{ path: file, reason: 'ESLint configuration file present' }],
        },
      ];
    }
  }
  return [];
}

async function detectFormattingConvention(root: string): Promise<ConventionFinding[]> {
  const candidates = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js'];
  for (const file of candidates) {
    if (await exists(join(root, file))) {
      return [
        {
          category: 'formatting',
          description: `Prettier is configured via "${file}".`,
          confidence: 'high',
          evidence: [{ path: file, reason: 'Prettier configuration file present' }],
        },
      ];
    }
  }
  return [];
}

async function detectImportAliasConvention(
  root: string,
  workspaces: DiscoveredWorkspace[],
): Promise<ConventionFinding[]> {
  const findings: ConventionFinding[] = [];
  for (const workspace of workspaces) {
    const tsconfigPath = join(workspace.absolutePath, 'tsconfig.json');
    try {
      const contents = await readFile(tsconfigPath, 'utf8');
      const parsed = JSON.parse(contents) as {
        compilerOptions?: { paths?: Record<string, string[]> };
      };
      const paths = parsed.compilerOptions?.paths;
      if (paths && Object.keys(paths).length > 0) {
        const aliases = Object.keys(paths).sort();
        findings.push({
          category: 'import-alias',
          description: `Defines import alias(es) ${aliases.join(', ')} in ${join(workspace.info.path, 'tsconfig.json')}.`,
          confidence: 'high',
          evidence: [
            {
              path: join(workspace.info.path, 'tsconfig.json').split('\\').join('/'),
              reason: `compilerOptions.paths declares: ${aliases.join(', ')}`,
            },
          ],
        });
      }
    } catch {
      continue;
    }
  }
  return findings;
}

function detectErrorHandlingConvention(files: WalkedFile[]): ConventionFinding[] {
  const errorFiles = files.filter((f) => /(^|\/)[^/]*(error|exception)s?\.[jt]sx?$/i.test(f.path));
  if (errorFiles.length < 2) return [];

  return [
    {
      category: 'error-handling',
      description: `Custom error/exception types are organized into dedicated files (${errorFiles.length} found).`,
      confidence: 'medium',
      evidence: errorFiles.slice(0, 5).map((f) => ({
        path: f.path,
        reason: 'file name indicates a custom error/exception type',
      })),
    },
  ];
}

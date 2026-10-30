import type { Evidence, Fact, FactOf } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { basename } from './path-utils.js';
import { SOURCE_EXTENSIONS, TEST_FILE_PATTERN } from './constants.js';

type RiskFact = FactOf<'risk-indicator'>;

/** Paths whose presence is a CI configuration, matched against root-relative paths. */
const CI_CONFIGURATION_PATTERN =
  /^(\.github\/workflows\/[^/]+\.ya?ml|\.gitlab-ci\.ya?ml|\.circleci\/config\.ya?ml|azure-pipelines\.ya?ml|bitbucket-pipelines\.ya?ml|\.travis\.ya?ml|Jenkinsfile|\.buildkite\/.+\.ya?ml|\.woodpecker\.ya?ml|\.drone\.ya?ml)$/;

/** LICENSE, LICENCE.md, LICENSE-MIT, LICENSE.APACHE-2.0, COPYING, UNLICENSE, … */
const LICENSE_FILE_PATTERN = /^(un)?(licen[cs]e|copying)([-._][a-z0-9.-]+)?$/i;

/** `.env` and `.env.<anything>`, except the conventionally committed template variants. */
const ENV_FILE_PATTERN = /^\.env(\..+)?$/;
const ENV_TEMPLATE_PATTERN = /\.(example|sample|template|dist|defaults)$/;

/** Root lockfiles that pin the dependencies a `package.json` declares. */
const JAVASCRIPT_LOCKFILES = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
]);

export interface RiskIndicatorInput {
  files: WalkedFile[];
  /** Facts already detected for the same repository; risks are conditions over them. */
  facts: Fact[];
  /** Whether the walk stopped at `maxFiles` before seeing every file. */
  truncated: boolean;
  maxFiles: number;
}

function risk(id: string, description: string, evidence: Evidence[]): RiskFact {
  return { category: 'risk-indicator', value: { id, description }, evidence };
}

function detectFileLimit({ truncated, maxFiles }: RiskIndicatorInput): RiskFact[] {
  if (!truncated) return [];
  return [
    risk(
      'file-limit-reached',
      `The repository has more than ${maxFiles} files; only ${maxFiles} were scanned, so this memory may be incomplete.`,
      [{ path: '.', reason: `walk stopped after ${maxFiles} files` }],
    ),
  ];
}

function detectMissingCi({ files }: RiskIndicatorInput): RiskFact[] {
  if (files.some((f) => CI_CONFIGURATION_PATTERN.test(f.path))) return [];
  return [
    risk('no-ci-configuration', 'No continuous integration configuration was found.', [
      {
        path: '.',
        reason:
          'no GitHub Actions, GitLab CI, CircleCI, Azure Pipelines, Bitbucket Pipelines, Travis CI, Jenkins, Buildkite, Woodpecker, or Drone configuration present',
      },
    ]),
  ];
}

function detectMissingTests({ files, facts }: RiskIndicatorInput): RiskFact[] {
  const testingFacts = facts.filter((f) => f.category === 'testing-framework');
  if (testingFacts.length === 0) return [];
  if (files.some((f) => TEST_FILE_PATTERN.test(f.path))) return [];
  return [
    risk('no-test-files', 'A test framework is declared, but no test files were found.', [
      ...testingFacts.flatMap((f) => f.evidence),
      { path: '.', reason: 'no file matches a test file naming pattern' },
    ]),
  ];
}

function detectMissingLicense({ files }: RiskIndicatorInput): RiskFact[] {
  if (files.some((f) => !f.path.includes('/') && LICENSE_FILE_PATTERN.test(f.path))) return [];
  return [
    risk('no-license', 'No license file was found at the repository root.', [
      { path: '.', reason: 'no LICENSE, LICENCE, or COPYING file at the repository root' },
    ]),
  ];
}

function detectMissingLockfile({ files }: RiskIndicatorInput): RiskFact[] {
  if (!files.some((f) => f.path === 'package.json')) return [];
  if (files.some((f) => JAVASCRIPT_LOCKFILES.has(f.path))) return [];
  return [
    risk(
      'no-lockfile',
      'package.json is present without a lockfile, so installs are not reproducible.',
      [
        {
          path: 'package.json',
          reason: 'no pnpm-lock.yaml, package-lock.json, yarn.lock, or bun lockfile at the root',
        },
      ],
    ),
  ];
}

function detectUnignoredEnvFiles({ files }: RiskIndicatorInput): RiskFact[] {
  const envFiles = files.filter((f) => {
    const name = basename(f.path);
    return ENV_FILE_PATTERN.test(name) && !ENV_TEMPLATE_PATTERN.test(name);
  });
  if (envFiles.length === 0) return [];
  return [
    risk(
      'env-file-not-ignored',
      'Environment files are not ignored by the root .gitignore and may contain secrets.',
      envFiles.map((f) => ({
        path: f.path,
        reason: 'present and not matched by the repository root .gitignore',
      })),
    ),
  ];
}

/**
 * Evidence-based risk signals, in emission order. Each is a concrete
 * absence or condition — never a subjective or stylistic judgment
 * (docs/implementation-blueprint.md SCAN-09).
 */
const RISK_DETECTORS: Array<(input: RiskIndicatorInput) => RiskFact[]> = [
  detectFileLimit,
  detectMissingCi,
  detectMissingTests,
  detectMissingLicense,
  detectMissingLockfile,
  detectUnignoredEnvFiles,
];

/**
 * Detects risk indicators from the walked file list and the Facts already
 * detected for it. Never reads file contents — in particular an `.env`
 * file's presence is the evidence, its contents are never opened.
 *
 * A repository with no source files at all produces only the file-limit
 * signal: "no CI" or "no license" for an empty directory is noise, not a
 * finding about a project.
 */
export function detectRiskIndicatorFacts(input: RiskIndicatorInput): RiskFact[] {
  const hasSource = input.files.some((f) => SOURCE_EXTENSIONS.has(f.extension));
  const detectors = hasSource ? RISK_DETECTORS : [detectFileLimit];
  return detectors.flatMap((detect) => detect(input));
}

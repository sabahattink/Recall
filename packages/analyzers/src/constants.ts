/**
 * Directories Recall never descends into, at any depth, regardless of
 * `.gitignore` contents: version-control internals, dependency installs,
 * and build/cache output whose contents describe a build, not the project.
 */
export const DEFAULT_IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
  'out',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  '.recall',
];

/**
 * Root-level directories named `.recall*` are Recall's own output and the
 * transient staging directories it writes that output through
 * (`@recall-ai/memory`'s output writer). Scanning them would make a run's
 * result depend on the previous run's leftovers.
 */
export const RECALL_OUTPUT_DIRECTORY_GLOB = '.recall*/**';

export const DEFAULT_MAX_FILES = 20_000;

export const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.py',
  '.go',
  '.rs',
]);

export const TEST_FILE_PATTERN =
  /\.(spec|test)\.[cm]?[jt]sx?$|(^|\/)__tests__\/|(^|\/)test\/.*\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.(py|go)$|(^|\/)tests\/.*\.(py|rs)$/;

export const CONFIG_FILE_PATTERN =
  /(^|\/)(package\.json|tsconfig.*\.json|\.eslintrc.*|eslint\.config\.[cm]?[jt]s|\.prettierrc.*|prettier\.config\.[cm]?js|biome\.jsonc?|jest\.config\.[cm]?[jt]s|vitest\.config\.[cm]?[jt]s|next\.config\.[cm]?[jt]s|nest-cli\.json|turbo\.json|pnpm-workspace\.yaml|docker-compose.*\.ya?ml|Dockerfile.*|pyproject\.toml|go\.mod|Cargo\.toml)$/i;

export const DOCUMENTATION_PATTERN = /\.(md|mdx)$/i;

/**
 * Files whose path or name marks them as tool output that survived the
 * walk (build directories are already excluded by DEFAULT_IGNORED_DIRECTORIES):
 * `__generated__/` trees, `*.generated.*` files, and protobuf stubs.
 */
export const GENERATED_FILE_PATTERN =
  /(^|\/)__generated__\/|\.generated\.[a-z]+$|\.pb\.go$|_pb2\.py$/;

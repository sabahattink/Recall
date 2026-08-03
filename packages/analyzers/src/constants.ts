/** Directories Recall never descends into, regardless of .gitignore contents. */
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
  '.recall',
];

export const DEFAULT_MAX_FILES = 20_000;

/** Files larger than this are recorded by metadata only; contents are never read. */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

export const TEST_FILE_PATTERN =
  /\.(spec|test)\.[jt]sx?$|(^|\/)__tests__\/|(^|\/)test\/.*\.[jt]sx?$/;

export const CONFIG_FILE_PATTERN =
  /(^|\/)(package\.json|tsconfig.*\.json|\.eslintrc.*|eslint\.config\.[cm]?js|\.prettierrc.*|prettier\.config\.[cm]?js|jest\.config\.[cm]?[jt]s|vitest\.config\.[cm]?[jt]s|next\.config\.[cm]?js|nest-cli\.json|turbo\.json|pnpm-workspace\.yaml|docker-compose.*\.ya?ml|Dockerfile.*|\.env.*)$/i;

export const DOCUMENTATION_PATTERN = /\.(md|mdx)$/i;

export const GENERATED_FILE_PATTERN = /(^|\/)(dist|build|coverage|\.next|out)\//;

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { name: string; version: string };

export const CLI_VERSION = packageJson.version;

/**
 * The executable command name, always `recall` regardless of the npm
 * package name (`@recall-ai/cli`). Do not derive this from `packageJson.name`
 * — splitting on `/` would make it track the package scope instead of the
 * actual `bin` entry the CLI is installed as.
 */
export const CLI_NAME = 'recall';

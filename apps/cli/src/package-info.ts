import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { name: string; version: string };

export const CLI_VERSION = packageJson.version;

/**
 * The executable command name, always `recall` regardless of the npm
 * package name (`recall-context`). Do not derive this from
 * `packageJson.name` — the two are allowed to diverge, and the actual
 * `bin` entry is the source of truth for what users type.
 */
export const CLI_NAME = 'recall';

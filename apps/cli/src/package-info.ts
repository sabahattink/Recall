import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { name: string; version: string };

export const CLI_VERSION = packageJson.version;
export const CLI_NAME = packageJson.name;

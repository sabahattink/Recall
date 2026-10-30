import { buildGoCliFixture } from './fixtures/go-cli.js';
import { buildNestJsFixture } from './fixtures/nestjs.js';
import { buildNextJsFixture } from './fixtures/nextjs.js';
import { buildPnpmMonorepoFixture } from './fixtures/pnpm-monorepo.js';
import { buildPythonServiceFixture } from './fixtures/python-service.js';
import { buildSimpleNodeFixture } from './fixtures/simple-node.js';

export interface ReferenceFixture {
  /** Stable name, also the golden-output directory name. */
  name: string;
  build: (root: string) => Promise<void>;
}

/**
 * The reference repositories every end-to-end and golden test runs against
 * (docs/implementation-blueprint.md REL-06): single-package and monorepo
 * shapes across the Node.js, Python, and Go ecosystems.
 */
export const REFERENCE_FIXTURES: readonly ReferenceFixture[] = [
  { name: 'simple-node', build: buildSimpleNodeFixture },
  { name: 'nestjs', build: buildNestJsFixture },
  { name: 'nextjs', build: buildNextJsFixture },
  { name: 'pnpm-monorepo', build: buildPnpmMonorepoFixture },
  { name: 'python-service', build: buildPythonServiceFixture },
  { name: 'go-cli', build: buildGoCliFixture },
];

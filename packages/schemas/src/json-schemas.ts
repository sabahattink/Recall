/**
 * JSON Schema representations of Recall's manifest and snapshot formats.
 *
 * These are maintained as TypeScript object literals (rather than imported
 * `.json` files) so the package has no runtime dependency on Node's ESM JSON
 * import attributes. The equivalent standalone `.json` files under
 * `src/json-schema/` are kept in sync for human reference and are copied into
 * `.recall/schema/` by the memory package so generated manifests can be
 * validated without depending on this package's node_modules.
 */

export const manifestJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://recall-ai.dev/schema/manifest.schema.json',
  title: 'Recall Manifest',
  type: 'object',
  required: [
    '$schema',
    'schemaVersion',
    'toolVersion',
    'repository',
    'generatedAt',
    'updatedAt',
    'snapshot',
    'files',
  ],
  properties: {
    $schema: { type: 'string' },
    schemaVersion: { type: 'string', const: '1.0.0' },
    toolVersion: { type: 'string' },
    repository: {
      type: 'object',
      required: ['name', 'root', 'defaultBranch'],
      properties: {
        name: { type: 'string' },
        root: { type: 'string' },
        defaultBranch: { type: ['string', 'null'] },
      },
    },
    generatedAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    snapshot: {
      type: 'object',
      required: ['commit', 'branch', 'path'],
      properties: {
        commit: { type: ['string', 'null'] },
        branch: { type: ['string', 'null'] },
        path: { type: 'string' },
      },
    },
    files: {
      type: 'object',
      required: [
        'architecture',
        'conventions',
        'decisions',
        'features',
        'glossary',
        'risks',
        'technicalDebt',
      ],
      properties: {
        architecture: { type: 'string' },
        conventions: { type: 'string' },
        decisions: { type: 'string' },
        features: { type: 'string' },
        glossary: { type: 'string' },
        risks: { type: 'string' },
        technicalDebt: { type: 'string' },
      },
    },
  },
} as const;

export const snapshotJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://recall-ai.dev/schema/snapshot.schema.json',
  title: 'Recall Repository Snapshot',
  type: 'object',
  required: [
    'schemaVersion',
    'repository',
    'git',
    'ecosystem',
    'workspaces',
    'files',
    'entryPoints',
    'dependencies',
    'internalEdges',
    'frameworks',
    'conventions',
    'risks',
    'testing',
    'ci',
    'docker',
    'serviceIntegrations',
    'generatedFiles',
    'ignoredDirectories',
    'generatedAt',
  ],
  properties: {
    schemaVersion: { type: 'string', const: '1.0.0' },
    repository: {
      type: 'object',
      required: ['name', 'root', 'description'],
      properties: {
        name: { type: 'string' },
        root: { type: 'string' },
        description: { type: ['string', 'null'] },
      },
    },
    git: {
      type: ['object', 'null'],
      properties: {
        isRepository: { const: true },
        branch: { type: ['string', 'null'] },
        commit: { type: ['string', 'null'] },
        isDirty: { type: 'boolean' },
        remoteUrl: { type: ['string', 'null'] },
        defaultBranch: { type: ['string', 'null'] },
        changedFiles: { type: 'array', items: { type: 'string' } },
      },
    },
    ecosystem: {
      type: 'object',
      properties: {
        packageManager: { enum: ['pnpm', 'npm', 'yarn', 'unknown'] },
        packageManagerVersion: { type: ['string', 'null'] },
        nodeVersionRange: { type: ['string', 'null'] },
        isMonorepo: { type: 'boolean' },
        workspaceGlobs: { type: 'array', items: { type: 'string' } },
        hasTypescript: { type: 'boolean' },
        hasLockfile: { type: 'boolean' },
        lockfilePath: { type: ['string', 'null'] },
      },
    },
    workspaces: { type: 'array' },
    files: { type: 'array' },
    entryPoints: { type: 'array' },
    dependencies: { type: 'array' },
    internalEdges: { type: 'array' },
    frameworks: { type: 'array' },
    conventions: { type: 'array' },
    risks: { type: 'array' },
    testing: {
      type: 'object',
      properties: {
        frameworks: { type: 'array', items: { type: 'string' } },
        testFiles: { type: 'array', items: { type: 'string' } },
      },
    },
    ci: {
      type: 'object',
      properties: {
        detected: { type: 'boolean' },
        providers: { type: 'array', items: { type: 'string' } },
        configFiles: { type: 'array', items: { type: 'string' } },
      },
    },
    docker: {
      type: 'object',
      properties: {
        detected: { type: 'boolean' },
        files: { type: 'array', items: { type: 'string' } },
      },
    },
    serviceIntegrations: { type: 'array' },
    generatedFiles: { type: 'array', items: { type: 'string' } },
    ignoredDirectories: { type: 'array', items: { type: 'string' } },
    generatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

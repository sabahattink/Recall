import { describe, expect, it } from 'vitest';
import {
  ManifestSchema,
  CURRENT_MANIFEST_SCHEMA_VERSION,
  runManifestMigrations,
} from '../manifest.js';

function validManifest() {
  return {
    $schema: './schema/manifest.schema.json',
    schemaVersion: CURRENT_MANIFEST_SCHEMA_VERSION,
    toolVersion: '0.1.0',
    repository: { name: 'example', root: '.', defaultBranch: 'main' },
    generatedAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    snapshot: { commit: 'abc123', branch: 'main', path: 'snapshots/latest.json' },
    files: {
      architecture: 'architecture.md',
      conventions: 'conventions.md',
      decisions: 'decisions.md',
      features: 'features.md',
      glossary: 'glossary.md',
      risks: 'risks.md',
      technicalDebt: 'technical-debt.md',
    },
  };
}

describe('ManifestSchema', () => {
  it('accepts a well-formed manifest', () => {
    const result = ManifestSchema.safeParse(validManifest());
    expect(result.success).toBe(true);
  });

  it('rejects a manifest with the wrong schema version', () => {
    const manifest = { ...validManifest(), schemaVersion: '0.0.1' };
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest missing required file entries', () => {
    const manifest = validManifest();
    // @ts-expect-error intentionally malformed for the test
    delete manifest.files.risks;
    const result = ManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
  });
});

describe('runManifestMigrations', () => {
  it('chains migrations until the current version is reached', () => {
    const input = { schemaVersion: '0.9.0', legacyField: true };
    const migrated = runManifestMigrations(input, [
      {
        fromVersion: '0.9.0',
        toVersion: '1.0.0',
        migrate: (doc) => ({ ...doc, schemaVersion: '1.0.0', migratedFrom: '0.9.0' }),
      },
    ]);
    expect(migrated.schemaVersion).toBe('1.0.0');
    expect(migrated.migratedFrom).toBe('0.9.0');
  });

  it('leaves documents already at the current version untouched', () => {
    const input = { schemaVersion: CURRENT_MANIFEST_SCHEMA_VERSION, files: {} };
    const migrated = runManifestMigrations(input, []);
    expect(migrated).toEqual(input);
  });
});

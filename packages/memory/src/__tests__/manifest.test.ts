import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createTempDir, removeTempDir } from '@recall-ai/test-fixtures';
import { buildManifest, readManifest, writeManifest } from '../manifest.js';
import { RECALL_DIR_NAME } from '../safe-fs.js';

describe('buildManifest', () => {
  it('produces a manifest matching the documented example shape', () => {
    const manifest = buildManifest({
      toolVersion: '0.1.0',
      repositoryName: 'example',
      repositoryRoot: '.',
      defaultBranch: 'main',
      commit: 'abc123',
      branch: 'main',
      snapshotPath: 'snapshots/latest.json',
    });

    expect(manifest.schemaVersion).toBe('1.0.0');
    expect(manifest.repository).toEqual({ name: 'example', root: '.', defaultBranch: 'main' });
    expect(manifest.snapshot).toEqual({
      commit: 'abc123',
      branch: 'main',
      path: 'snapshots/latest.json',
    });
    expect(manifest.files.architecture).toBe('architecture.md');
  });

  it('preserves generatedAt from an existing manifest across updates', () => {
    const first = buildManifest({
      toolVersion: '0.1.0',
      repositoryName: 'example',
      repositoryRoot: '.',
      defaultBranch: 'main',
      commit: 'abc123',
      branch: 'main',
      snapshotPath: 'snapshots/latest.json',
    });

    const second = buildManifest({
      toolVersion: '0.1.0',
      repositoryName: 'example',
      repositoryRoot: '.',
      defaultBranch: 'main',
      commit: 'def456',
      branch: 'main',
      snapshotPath: 'snapshots/latest.json',
      existing: first,
    });

    expect(second.generatedAt).toBe(first.generatedAt);
    expect(second.snapshot.commit).toBe('def456');
  });
});

describe('readManifest / writeManifest', () => {
  let root: string;

  beforeEach(async () => {
    root = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(root);
  });

  it('round-trips a manifest through disk', async () => {
    const manifest = buildManifest({
      toolVersion: '0.1.0',
      repositoryName: 'example',
      repositoryRoot: '.',
      defaultBranch: 'main',
      commit: 'abc123',
      branch: 'main',
      snapshotPath: 'snapshots/latest.json',
    });

    await writeManifest(root, manifest);
    const { manifest: read, error } = await readManifest(root);
    expect(error).toBeNull();
    expect(read).toEqual(manifest);
  });

  it('returns null with no error when no manifest exists yet', async () => {
    const { manifest, error } = await readManifest(root);
    expect(manifest).toBeNull();
    expect(error).toBeNull();
  });

  it('reports an error for malformed JSON', async () => {
    await mkdir(join(root, RECALL_DIR_NAME), { recursive: true });
    await writeFile(join(root, RECALL_DIR_NAME, 'manifest.json'), '{ not valid json', 'utf8');
    const { manifest, error } = await readManifest(root);
    expect(manifest).toBeNull();
    expect(error).toContain('not valid JSON');
  });

  it('reports an error for a manifest missing required fields', async () => {
    await mkdir(join(root, RECALL_DIR_NAME), { recursive: true });
    await writeFile(
      join(root, RECALL_DIR_NAME, 'manifest.json'),
      JSON.stringify({ schemaVersion: '1.0.0' }),
      'utf8',
    );
    const { manifest, error } = await readManifest(root);
    expect(manifest).toBeNull();
    expect(error).not.toBeNull();
  });
});

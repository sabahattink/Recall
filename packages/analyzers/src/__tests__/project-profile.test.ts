import { describe, expect, it } from 'vitest';
import type { EcosystemMetadata, EntryPoint, FrameworkDetection } from '@recall-ai/schemas';
import { detectProjectProfile, formatProjectProfile } from '../project-profile.js';

function ecosystem(overrides: Partial<EcosystemMetadata> = {}): EcosystemMetadata {
  return {
    packageManager: 'pnpm',
    packageManagerVersion: null,
    nodeVersionRange: null,
    isMonorepo: false,
    workspaceGlobs: [],
    hasTypescript: true,
    hasLockfile: true,
    lockfilePath: 'pnpm-lock.yaml',
    ...overrides,
  };
}

const binEntry: EntryPoint = { path: 'dist/index.js', workspace: null, kind: 'bin', evidence: [] };

function framework(name: FrameworkDetection['name']): FrameworkDetection {
  return { name, workspace: null, confidence: 'high', evidence: [] };
}

describe('detectProjectProfile', () => {
  it('identifies a TypeScript CLI monorepo (the Recall repository shape)', () => {
    const profile = detectProjectProfile(ecosystem({ isMonorepo: true }), [binEntry], []);
    expect(profile).toEqual({
      language: 'TypeScript',
      applicationType: 'cli',
      repositoryType: 'monorepo',
      frameworks: [],
    });
    expect(formatProjectProfile(profile)).toBe('TypeScript CLI monorepo');
  });

  it('identifies a JavaScript single-package library with no bin and no framework', () => {
    const profile = detectProjectProfile(ecosystem({ hasTypescript: false }), [], []);
    expect(profile.language).toBe('JavaScript');
    expect(profile.applicationType).toBe('library');
    expect(profile.repositoryType).toBe('single-package');
    expect(formatProjectProfile(profile)).toBe('JavaScript library');
  });

  it('identifies an API service from NestJS/Express detection when there is no bin entry', () => {
    const profile = detectProjectProfile(ecosystem(), [], [framework('nestjs')]);
    expect(profile.applicationType).toBe('api-service');
    expect(profile.frameworks).toEqual(['nestjs']);
    expect(formatProjectProfile(profile)).toBe('TypeScript API service');
  });

  it('identifies a web app from Next.js/React detection', () => {
    const profile = detectProjectProfile(ecosystem(), [], [framework('nextjs')]);
    expect(profile.applicationType).toBe('web-app');
    expect(formatProjectProfile(profile)).toBe('TypeScript web app');
  });

  it('prefers "cli" over a detected framework when a bin entry exists', () => {
    const profile = detectProjectProfile(ecosystem(), [binEntry], [framework('express')]);
    expect(profile.applicationType).toBe('cli');
    // Real framework detection is preserved even though applicationType is "cli".
    expect(profile.frameworks).toEqual(['express']);
  });

  it('excludes "generic-node" from the frameworks list (it is not a real framework)', () => {
    const profile = detectProjectProfile(ecosystem(), [], [framework('generic-node')]);
    expect(profile.frameworks).toEqual([]);
    expect(profile.applicationType).toBe('library');
  });
});

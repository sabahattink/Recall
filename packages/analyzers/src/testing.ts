import type { DependencyRecord, TestingInfo } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import { TEST_FILE_PATTERN } from './constants.js';

const TEST_FRAMEWORK_DEPENDENCIES = [
  'vitest',
  'jest',
  'mocha',
  'ava',
  'jasmine',
  '@playwright/test',
];

export function detectTesting(files: WalkedFile[], dependencies: DependencyRecord[]): TestingInfo {
  const testFiles = files
    .filter((f) => TEST_FILE_PATTERN.test(f.path))
    .map((f) => f.path)
    .sort();

  const declaredNames = new Set(dependencies.map((d) => d.name));
  const frameworks = TEST_FRAMEWORK_DEPENDENCIES.filter((name) => declaredNames.has(name)).sort();

  return { frameworks, testFiles };
}

import type { FileKind, FileRecord } from '@recall-ai/schemas';
import type { WalkedFile } from './file-walk.js';
import {
  CONFIG_FILE_PATTERN,
  DOCUMENTATION_PATTERN,
  GENERATED_FILE_PATTERN,
  SOURCE_EXTENSIONS,
  TEST_FILE_PATTERN,
} from './constants.js';
import type { DiscoveredWorkspace } from './workspaces.js';

export function classifyFiles(
  files: WalkedFile[],
  workspaces: DiscoveredWorkspace[],
): FileRecord[] {
  const sortedWorkspacePaths = [...workspaces]
    .map((w) => w.info.path)
    .filter((p) => p !== '.')
    .sort((a, b) => b.length - a.length);

  return files.map((file) => ({
    path: file.path,
    workspace: ownerWorkspace(file.path, sortedWorkspacePaths),
    kind: classifyKind(file),
    sizeBytes: file.sizeBytes,
    extension: file.extension,
  }));
}

function ownerWorkspace(path: string, workspacePaths: string[]): string | null {
  for (const workspacePath of workspacePaths) {
    if (path === workspacePath || path.startsWith(`${workspacePath}/`)) {
      return workspacePath;
    }
  }
  return null;
}

function classifyKind(file: WalkedFile): FileKind {
  if (GENERATED_FILE_PATTERN.test(file.path)) return 'generated';
  if (TEST_FILE_PATTERN.test(file.path)) return 'test';
  if (DOCUMENTATION_PATTERN.test(file.path)) return 'documentation';
  if (CONFIG_FILE_PATTERN.test(file.path.split('/').pop() ?? '')) return 'config';
  if (SOURCE_EXTENSIONS.has(file.extension)) return 'source';
  return 'other';
}

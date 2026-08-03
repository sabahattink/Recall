import { join } from 'node:path';
import { atomicWriteFile, generateContext, readSnapshot } from '@recall-ai/memory';
import { InvalidStateError } from '../errors.js';
import { recallDirFor, resolveRepositoryRoot } from '../paths.js';

export interface ContextCommandOptions {
  path: string;
  task?: string;
  maxTokens?: number;
  stdout?: boolean;
}

export interface ContextCommandResult {
  content: string;
  estimatedTokens: number;
  truncated: boolean;
  outputPath: string | null;
}

export async function runContext(options: ContextCommandOptions): Promise<ContextCommandResult> {
  const root = await resolveRepositoryRoot(options.path);
  const recallDir = recallDirFor(root);
  const { snapshot, error } = await readSnapshot(recallDir);

  if (!snapshot) {
    throw new InvalidStateError(
      error
        ? `Recall snapshot is corrupted: ${error}. Run \`recall init --force\` or \`recall scan\` to rebuild it.`
        : 'No Recall snapshot found. Run `recall init` or `recall scan` first.',
    );
  }

  const { content, estimatedTokens, truncated } = generateContext(snapshot, {
    task: options.task,
    maxTokens: options.maxTokens,
  });

  let outputPath: string | null = null;
  if (!options.stdout) {
    outputPath = join(recallDir, 'context.md');
    await atomicWriteFile(outputPath, content);
  }

  return { content, estimatedTokens, truncated, outputPath };
}

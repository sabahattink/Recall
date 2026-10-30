import { join } from 'node:path';
import type { GitMetadata } from '@recall-ai/schemas';
import { GitAdapter } from '@recall-ai/git';
import { scanRepository } from '@recall-ai/analyzers';
import {
  RECALL_DIR_NAME,
  RecallDirectoryExistsError,
  UnsafeOutputLocationError as MemoryUnsafeOutputLocationError,
  inspectRecallDirectory,
  normalizeFacts,
  serializeProjectMemory,
  writeRecallDirectory,
  type OutputFile,
} from '@recall-ai/memory';
import { DEFAULT_TEMPLATE_REGISTRY, type TemplateRegistry } from '@recall-ai/templates';
import { AlreadyInitializedError, UnsafeOutputLocationError } from './errors.js';
import { resolveRepositoryRoot } from './paths.js';

/** The pipeline stages of spec §14, in the order they run. */
export type InitStage = 'scan' | 'memory' | 'generate';

export const MEMORY_FILE_NAME = 'memory.json';

export interface InitOptions {
  /** Repository to initialize; relative paths resolve against the working directory. */
  path: string;
  /** Replace an existing `.recall/` instead of refusing. */
  force: boolean;
  /** Called as each stage starts, so a frontend can report progress. */
  onStage?: (stage: InitStage) => void;
  /** Agent templates to render. Defaults to the five v1 templates. */
  templates?: TemplateRegistry;
  /** Reads Git metadata for the repository. Defaults to the read-only `GitAdapter`. */
  readGitMetadata?: (root: string) => Promise<GitMetadata | null>;
}

export interface InitResult {
  root: string;
  recallDirectory: string;
  /** Written files, relative to `recallDirectory`, in write order. */
  files: string[];
}

function defaultReadGitMetadata(root: string): Promise<GitMetadata | null> {
  return new GitAdapter(root).collectMetadata();
}

/**
 * Refuses up front, before any scanning, when the run could not end in a
 * write: an existing `.recall/` without `force`, or a `.recall` that is a
 * symlink or a file. `writeRecallDirectory` re-checks at write time; this
 * early check only makes the refusal immediate and side-effect free.
 */
async function assertCanWrite(root: string, force: boolean): Promise<void> {
  const recallDirectory = join(root, RECALL_DIR_NAME);
  const state = await inspectRecallDirectory(root);
  if (state === 'symlink') {
    throw new UnsafeOutputLocationError(
      `${recallDirectory} is a symlink. Recall never writes through a symlink — replace it with a real directory or remove it.`,
    );
  }
  if (state === 'not-a-directory') {
    throw new UnsafeOutputLocationError(`${recallDirectory} exists and is not a directory.`);
  }
  if (state === 'directory' && !force) throw new AlreadyInitializedError(recallDirectory);
}

/** Translates the output writer's errors into this package's exit-code-bearing errors. */
function translateWriteError(error: unknown, recallDirectory: string): unknown {
  if (error instanceof RecallDirectoryExistsError)
    return new AlreadyInitializedError(recallDirectory);
  if (error instanceof MemoryUnsafeOutputLocationError) {
    return new UnsafeOutputLocationError(error.message);
  }
  return error;
}

/**
 * `recall init` (CLI-02): Repository → Scanner → Project Memory → Agent
 * Templates → Disk (docs/product-specification.md §14).
 *
 * This function only sequences the stages and propagates their errors —
 * scanning, normalization, rendering, and writing each live in their own
 * package. Every stage completes in memory before anything touches disk, so
 * a failure at any stage aborts with the repository unchanged, and the
 * final write is itself all-or-nothing (spec §20).
 */
export async function runInit(options: InitOptions): Promise<InitResult> {
  const root = await resolveRepositoryRoot(options.path);
  const recallDirectory = join(root, RECALL_DIR_NAME);
  await assertCanWrite(root, options.force);

  options.onStage?.('scan');
  const git = await (options.readGitMetadata ?? defaultReadGitMetadata)(root);
  const facts = await scanRepository(root, { git });

  options.onStage?.('memory');
  const memory = normalizeFacts(facts);

  options.onStage?.('generate');
  const registry = options.templates ?? DEFAULT_TEMPLATE_REGISTRY;
  const files: OutputFile[] = [
    { path: MEMORY_FILE_NAME, contents: serializeProjectMemory(memory) },
    ...registry.render(memory),
  ];

  try {
    await writeRecallDirectory(root, files, { force: options.force });
  } catch (error) {
    throw translateWriteError(error, recallDirectory);
  }

  return { root, recallDirectory, files: files.map((file) => file.path) };
}

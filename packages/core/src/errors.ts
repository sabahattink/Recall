/**
 * Process exit codes for `recall init` (CLI-06). Each failure condition has
 * exactly one dedicated code; these values are a public contract
 * (docs/implementation-blueprint.md §4) and documented in
 * docs/cli-reference.md.
 */
export const ExitCode = {
  Success: 0,
  UnexpectedFailure: 1,
  InvalidUsage: 2,
  InvalidPath: 3,
  AlreadyInitialized: 4,
  UnsafeOutputLocation: 5,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** Base class for every error Recall raises deliberately (as opposed to a bug). */
export class RecallError extends Error {
  constructor(
    message: string,
    readonly exitCode: ExitCodeValue,
  ) {
    super(message);
    this.name = 'RecallError';
  }
}

/** Unknown command, unknown flag, or too many arguments. */
export class InvalidUsageError extends RecallError {
  constructor(message: string) {
    super(message, ExitCode.InvalidUsage);
    this.name = 'InvalidUsageError';
  }
}

/** The repository path does not exist, is not a directory, or cannot be read. */
export class InvalidPathError extends RecallError {
  constructor(message: string) {
    super(message, ExitCode.InvalidPath);
    this.name = 'InvalidPathError';
  }
}

/** `.recall/` already exists and `--force` was not given. Nothing was changed. */
export class AlreadyInitializedError extends RecallError {
  constructor(recallDirectory: string) {
    super(
      `${recallDirectory} already exists. Nothing was changed; run "recall init --force" to regenerate it.`,
      ExitCode.AlreadyInitialized,
    );
    this.name = 'AlreadyInitializedError';
  }
}

/** `.recall` is a symlink or a non-directory, which Recall refuses to write through. */
export class UnsafeOutputLocationError extends RecallError {
  constructor(message: string) {
    super(message, ExitCode.UnsafeOutputLocation);
    this.name = 'UnsafeOutputLocationError';
  }
}

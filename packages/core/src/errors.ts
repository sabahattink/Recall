export const ExitCode = {
  Success: 0,
  UnexpectedFailure: 1,
  InvalidUsage: 2,
  InvalidState: 3,
  StaleMemory: 4,
  AnalysisIncomplete: 5,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** Base class for all errors Recall raises deliberately (as opposed to bugs). */
export class RecallError extends Error {
  constructor(
    message: string,
    readonly exitCode: ExitCodeValue,
  ) {
    super(message);
    this.name = 'RecallError';
  }
}

export class InvalidUsageError extends RecallError {
  constructor(message: string) {
    super(message, ExitCode.InvalidUsage);
    this.name = 'InvalidUsageError';
  }
}

export class InvalidStateError extends RecallError {
  constructor(message: string) {
    super(message, ExitCode.InvalidState);
    this.name = 'InvalidStateError';
  }
}

export class StaleMemoryError extends RecallError {
  constructor(message: string) {
    super(message, ExitCode.StaleMemory);
    this.name = 'StaleMemoryError';
  }
}

export class AnalysisIncompleteError extends RecallError {
  constructor(message: string) {
    super(message, ExitCode.AnalysisIncomplete);
    this.name = 'AnalysisIncompleteError';
  }
}

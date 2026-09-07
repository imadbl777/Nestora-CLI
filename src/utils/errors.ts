export class NestoraError extends Error {
  constructor(message: string, public readonly exitCode = 1) {
    super(message);
    this.name = 'NestoraError';
  }
}

export class NotANestProjectError extends NestoraError {
  constructor(message: string) {
    super(message, 1);
    this.name = 'NotANestProjectError';
  }
}

export class AlreadyConfiguredError extends NestoraError {
  constructor(message: string) {
    super(message, 0);
    this.name = 'AlreadyConfiguredError';
  }
}

export class AbortedError extends NestoraError {
  constructor(message = 'Aborted.') {
    super(message, 1);
    this.name = 'AbortedError';
  }
}

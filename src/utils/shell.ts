import { spawnSync } from 'node:child_process';
import { logger } from './logger.js';

export interface ShellOptions {
  cwd?: string;
  stdio?: 'pipe' | 'inherit' | 'ignore';
  /** Timeout in milliseconds. On timeout the child is killed and `error.code` is `ETIMEDOUT`. */
  timeout?: number;
}

export interface ShellResult {
  status: number | null;
  stdout: string;
  stderr: string;
  /** Set when the process could not be spawned or was killed (e.g. timeout: `code === 'ETIMEDOUT'`). */
  error?: NodeJS.ErrnoException | undefined;
}

/**
 * Build the single command line used by `cmd.exe` on Windows.
 *
 * On win32, shell-style commands (npm/pnpm/yarn/bun are `.cmd`/`.bat`
 * wrappers) can only be launched through a shell, but with `shell: true`
 * Node joins arguments with a plain space — so any argument containing a
 * space would be silently split into two. We therefore quote every argument
 * ourselves so boundaries survive, and refuse characters `cmd.exe` would
 * interpret even inside quotes (`%` expands variables; `"` or newlines would
 * corrupt the line). None of the arguments this CLI actually generates ever
 * hit those characters, so the throw only guards against future misuse
 * instead of corrupting a command.
 */
export function quoteCommandLine(command: string, args: string[]): string {
  if (/\s/.test(command)) {
    throw new Error(
      `Cannot run ${JSON.stringify(command)} on Windows: the command name contains whitespace.`,
    );
  }
  const parts = [command];
  for (const arg of args) {
    if (/["%\r\n]/.test(arg)) {
      throw new Error(
        `Cannot run ${JSON.stringify(command)} on Windows: argument contains a character cmd.exe cannot pass safely: ${JSON.stringify(arg)}`,
      );
    }
    parts.push(arg.length === 0 ? '""' : `"${arg}"`);
  }
  return parts.join(' ');
}

export function run(
  command: string,
  args: string[],
  options: ShellOptions = {},
): ShellResult {
  const win32 = process.platform === 'win32';
  const result = spawnSync(
    win32 ? quoteCommandLine(command, args) : command,
    win32 ? [] : args,
    {
      cwd: options.cwd,
      stdio: options.stdio === 'inherit' ? 'inherit' : 'pipe',
      encoding: 'utf8',
      shell: win32,
      timeout: options.timeout,
    },
  );

  return {
    status: result.status,
    stdout: (result.stdout as string) ?? '',
    stderr: (result.stderr as string) ?? '',
    error: result.error as NodeJS.ErrnoException | undefined,
  };
}

export class CommandFailedError extends Error {
  constructor(command: string, result: ShellResult) {
    super(
      `Command failed (${command}): ${(result.stderr || result.stdout).trim() || 'unknown error'}`,
    );
    this.name = 'CommandFailedError';
  }
}

export function runOrThrow(
  command: string,
  args: string[],
  options: ShellOptions = {},
): ShellResult {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new CommandFailedError(command, result);
  }
  return result;
}

export function installPackages(
  packageManager: string,
  packages: string[],
  cwd: string,
  dev = false,
): void {
  const installArgs = packageManager === 'npm'
    ? ['install', ...(dev ? ['-D'] : []), ...packages]
    : ['add', ...(dev ? ['-D'] : []), ...packages];

  logger.step(`Installing ${packages.join(', ')} with ${packageManager}...`);
  const result = run(packageManager, installArgs, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new CommandFailedError(`${packageManager} ${installArgs.join(' ')}`, result);
  }
}

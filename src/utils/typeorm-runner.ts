import * as fs from 'node:fs';
import * as path from 'node:path';
import { run, type ShellOptions, type ShellResult } from './shell.js';
import { NestoraError } from './errors.js';
import type { SetupContext } from '../core/context.js';

export type MigrationVerb = 'generate' | 'run' | 'revert' | 'show';

/**
 * The ts-node wrapped CLI scripts that TypeORM ships inside the package itself.
 * When present we invoke them directly with `node` instead of spawning the bare
 * runner name, because npm scripts get `node_modules/.bin` injected into PATH
 * but a child process spawned by the CLI does not — on Windows the bare
 * `typeorm-ts-node-commonjs` name would otherwise not resolve.
 */
const RUNNER_SCRIPTS: Record<string, string> = {
  'typeorm-ts-node-commonjs': 'cli-ts-node-commonjs.js',
  'typeorm-ts-node-esm': 'cli-ts-node-esm.js',
};

/**
 * Build the TypeORM command line for a given migration verb.
 *
 * This is the single source of truth for how the TypeORM CLI is invoked. Both
 * the generated `package.json` migration scripts (see
 * `generators/typeorm/migrations.ts`) and the `nestora migration:*` commands
 * build their command here, so the two can never drift apart.
 *
 * The DataSource path and the migrations directory are resolved relative to
 * the project root with forward slashes, matching the existing project
 * conventions and keeping the command shell-agnostic (no `$NPM_*` expansion).
 */
export function buildMigrationCommand(
  context: SetupContext,
  verb: 'run' | 'revert' | 'show',
): string[] {
  const ds = relativeToRoot(context, dataSourcePath(context));
  return [context.migrationRunner, '-d', ds, `migration:${verb}`];
}

/**
 * `migration:generate` takes a positional migration class name in addition to
 * the DataSource flag, so the resulting command includes the output path:
 * `<migrationsDir>/<Name>`. The name is appended verbatim — no case
 * transformation is applied, so PascalCase, kebab-case and snake_case all pass
 * through untouched.
 *
 * When `name` is omitted the base `migration:generate` command is returned
 * (used by the generated `package.json` script, where the user supplies the
 * name at call time).
 */
export function buildMigrationGenerateCommand(
  context: SetupContext,
  name?: string,
): string[] {
  const base = [
    context.migrationRunner,
    '-d',
    relativeToRoot(context, dataSourcePath(context)),
    'migration:generate',
  ];
  if (!name) return base;
  const dir = relativeToRoot(context, migrationsDirectory(context));
  return [...base, `${dir}/${name}`];
}

/**
 * Resolve the absolute path to the ts-node wrapped TypeORM CLI script shipped
 * inside the `typeorm` package, or `undefined` when it cannot be found (e.g.
 * TypeORM is globally installed and there is no local `node_modules/typeorm`).
 */
export function typeormCliScript(context: SetupContext): string | undefined {
  const script = RUNNER_SCRIPTS[context.migrationRunner];
  if (!script) return undefined;
  const candidate = path.join(
    context.projectRoot,
    'node_modules',
    'typeorm',
    script,
  );
  return fs.existsSync(candidate) ? candidate : undefined;
}

/**
 * Run the built TypeORM command in the project root, streaming TypeORM's own
 * output through to the user. Returns the raw ShellResult so the caller owns
 * error mapping and the exit code.
 *
 * The command produced by the builders starts with the runner name (for
 * example `typeorm-ts-node-commonjs`). Inside an npm script that name resolves
 * through `node_modules/.bin`. When spawned directly by the CLI, that `.bin`
 * entry is not on the child's PATH on Windows, so when TypeORM's own wrapped
 * CLI script is available locally we rewrite the first token to
 * `node <node_modules/typeorm/cli-ts-node-*.js>`.
 */
export function runMigration(
  context: SetupContext,
  argv: string[],
  options: ShellOptions = {},
): ShellResult {
  const script = typeormCliScript(context);
  let command = argv[0];
  let args = argv.slice(1);
  if (script && command === context.migrationRunner) {
    command = 'node';
    args = [script, ...args];
  }
  return run(command, args, {
    cwd: context.projectRoot,
    stdio: 'inherit',
    ...options,
  });
}

/**
 * Map a non-zero / failed migration run to a helpful error. TypeORM's own
 * stderr/stdout is preserved (it was already streamed via `stdio: 'inherit'`),
 * so we only wrap unmistakable infra failures (e.g. the runner binary missing)
 * with guidance; genuine TypeORM errors are passed through.
 */
export function migrationFailure(command: string, result: ShellResult): NestoraError {
  if (result.error?.code === 'ENOENT') {
    return new NestoraError(
      `Could not run the TypeORM CLI (${command}).\n` +
        'Make sure TypeORM is installed, then run: npx nestora typeorm',
    );
  }
  if (result.error?.code === 'ETIMEDOUT') {
    return new NestoraError('The migration command timed out and was killed.');
  }
  // The process ran but exited non-zero. Its output was already shown; expose
  // a concise summary and reuse TypeORM's exit code.
  return new NestoraError(
    `Command failed (${command}). See output above.`,
    result.status ?? 1,
  );
}

export function dataSourcePath(context: SetupContext): string {
  return path.join(context.nest.sourceRoot, 'database', 'data-source.ts');
}

export function migrationsDirectory(context: SetupContext): string {
  return path.join(context.nest.sourceRoot, 'database', 'migrations');
}

function relativeToRoot(context: SetupContext, target: string): string {
  return path.relative(context.projectRoot, target).replace(/\\/g, '/');
}

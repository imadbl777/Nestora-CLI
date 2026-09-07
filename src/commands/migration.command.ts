import { Command } from 'commander';
import * as fs from 'node:fs';
import { resolveMigrationProject } from '../core/migration-context.js';
import {
  buildMigrationCommand,
  buildMigrationGenerateCommand,
  migrationsDirectory,
  runMigration,
  migrationFailure,
} from '../utils/typeorm-runner.js';
import { handleError } from './typeorm.command.js';
import { ensureDirectory } from '../utils/filesystem.js';
import { NestoraError } from '../utils/errors.js';

/**
 * `nestora migration:generate <Name>`
 *
 * Generates a new migration by diffing your entities against the database.
 * The DataSource path and the migrations directory are resolved automatically,
 * and the CommonJS/ESM runner is chosen from the target project's module
 * system - no `-d` flag or manual path is needed.
 * Exported so the flow can be tested without a TTY.
 */
export async function runMigrationGenerate(
  name: string | undefined,
  cwd: string = process.cwd(),
): Promise<void> {
  if (!name || name.trim() === '') {
    throw new NestoraError(
      'migration:generate requires a migration name.\nExample: npx nestora migration:generate CreateTodos',
    );
  }
  if (/[/\\]/.test(name) || /\s/.test(name)) {
    throw new NestoraError(
      `Invalid migration name "${name}".\nUse a single identifier such as CreateTodos (the name becomes a TypeScript class name).`,
    );
  }

  const { context } = resolveMigrationProject(cwd);

  const dir = migrationsDirectory(context);
  if (!fs.existsSync(dir)) {
    ensureDirectory(dir);
  }

  const argv = buildMigrationGenerateCommand(context, name.trim());
  const result = runMigration(context, argv);
  if (result.status !== 0) {
    throw migrationFailure(argv.join(' '), result);
  }
}

/**
 * `nestora migration:run`
 *
 * Applies all pending migrations.
 * Exported so the flow can be tested without a TTY.
 */
export async function runMigrationRun(cwd: string = process.cwd()): Promise<void> {
  const { context } = resolveMigrationProject(cwd);
  const argv = buildMigrationCommand(context, 'run');
  const result = runMigration(context, argv);
  if (result.status !== 0) {
    throw migrationFailure(argv.join(' '), result);
  }
}

/**
 * `nestora migration:revert`
 *
 * Reverts the last applied migration.
 * Exported so the flow can be tested without a TTY.
 */
export async function runMigrationRevert(cwd: string = process.cwd()): Promise<void> {
  const { context } = resolveMigrationProject(cwd);
  const argv = buildMigrationCommand(context, 'revert');
  const result = runMigration(context, argv);
  if (result.status !== 0) {
    throw migrationFailure(argv.join(' '), result);
  }
}

/**
 * `nestora migration:show`
 *
 * Lists applied and pending migrations.
 * Exported so the flow can be tested without a TTY.
 */
export async function runMigrationShow(cwd: string = process.cwd()): Promise<void> {
  const { context } = resolveMigrationProject(cwd);
  const argv = buildMigrationCommand(context, 'show');
  const result = runMigration(context, argv);
  if (result.status !== 0) {
    throw migrationFailure(argv.join(' '), result);
  }
}

function wrap(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (error) {
      handleError(error);
    }
  };
}

/**
 * The four `nestora migration:*` commands, registered as top-level commands so
 * they are invoked with the colon syntax (`nestora migration:generate X`).
 */
export const migrationCommands: Command[] = [
  new Command('migration:generate')
    .description('Generate a migration by diffing entities against the database.')
    .argument('<name>', 'migration class name, e.g. CreateTodos')
    .action((name: string) => wrap(() => runMigrationGenerate(name))()),

  new Command('migration:run')
    .description('Apply all pending migrations.')
    .action(() => wrap(runMigrationRun)()),

  new Command('migration:revert')
    .description('Revert the most recently applied migration.')
    .action(() => wrap(runMigrationRevert)()),

  new Command('migration:show')
    .description('List applied and pending migrations.')
    .action(() => wrap(runMigrationShow)()),
];
import * as path from 'node:path';
import type { SetupContext } from '../../core/context.js';
import {
  buildMigrationCommand,
  buildMigrationGenerateCommand,
  migrationsDirectory,
} from '../../utils/typeorm-runner.js';

export { migrationsDirectory };

export interface MigrationScripts {
  typeorm: string;
  'migration:generate': string;
  'migration:run': string;
  'migration:revert': string;
}

export function buildMigrationScripts(context: SetupContext): MigrationScripts {
  // The npm scripts are one-line joins of the same command vectors the
  // `nestora migration:*` commands run, so the two interfaces never drift.
  // migration:generate keeps a positional <path> argument (the migration
  // class name) so it stays shell-agnostic. The DataSource flag and migrations
  // directory are supplied automatically from the shared mapping.
  return {
    typeorm: context.migrationRunner,
    'migration:generate': buildMigrationGenerateCommand(context).join(' '),
    'migration:run': buildMigrationCommand(context, 'run').join(' '),
    'migration:revert': buildMigrationCommand(context, 'revert').join(' '),
  };
}

export function packageJsonPath(context: SetupContext): string {
  return path.join(context.projectRoot, 'package.json');
}
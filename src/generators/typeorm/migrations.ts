import * as path from 'node:path';
import type { SetupContext } from '../../core/context.js';
import { dataSourcePath } from './datasource.js';

export interface MigrationScripts {
  typeorm: string;
  'migration:generate': string;
  'migration:run': string;
  'migration:revert': string;
}

function dataSourceArg(context: SetupContext): string {
  const dsPath = dataSourcePath(context);
  return path.relative(context.projectRoot, dsPath).replace(/\\/g, '/');
}

export function buildMigrationScripts(context: SetupContext): MigrationScripts {
  const runner = context.migrationRunner;
  const ds = dataSourceArg(context);

  // migration:generate takes a positional <path> so it stays shell-agnostic
  // (no $npm_config_name / %npm_config_name% env var expansion needed):
  //   npm run migration:generate -- src/database/migrations/TodoItem
  return {
    typeorm: `${runner}`,
    'migration:generate': `${runner} -d ${ds} migration:generate`,
    'migration:run': `${runner} -d ${ds} migration:run`,
    'migration:revert': `${runner} -d ${ds} migration:revert`,
  };
}

export function migrationsDirectory(context: SetupContext): string {
  return path.join(context.nest.sourceRoot, 'database', 'migrations');
}

export function packageJsonPath(context: SetupContext): string {
  return path.join(context.projectRoot, 'package.json');
}
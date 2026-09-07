import * as fs from 'node:fs';
import type { SetupContext } from '../../core/context.js';
import { AlreadyConfiguredError } from '../../utils/errors.js';
import type { TypeORMPlan } from './plan.js';
import { getDependencies } from './dependencies.js';
import { buildEnvContent, envPath } from './environment.js';
import { buildDatabaseConfigContent, databaseConfigPath } from './config.js';
import { buildDataSourceContent, dataSourcePath } from './datasource.js';
import { buildMigrationScripts, migrationsDirectory, packageJsonPath } from './migrations.js';
import { configImportPathFor } from './nest-module.js';

export { getDependencies } from './dependencies.js';
export { databaseConfigPath } from './config.js';
export { migrationsDirectory } from './migrations.js';
export { dataSourcePath } from './datasource.js';

export { configImportPathFor } from './nest-module.js';

export type ExistingState = 'none' | 'partial' | 'complete';

export function checkExistingSetup(context: SetupContext): ExistingState {
  const configExists = fs.existsSync(databaseConfigPath(context));
  const dsExists = fs.existsSync(dataSourcePath(context));

  if (configExists && dsExists) return 'complete';
  if (configExists || dsExists) return 'partial';
  return 'none';
}

export function createTypeORMPlan(
  context: SetupContext,
  options: { force?: boolean } = {},
): TypeORMPlan {
  const state = checkExistingSetup(context);
  if (state === 'complete' && !options.force) {
    throw new AlreadyConfiguredError(
      'TypeORM is already configured. Nothing changed.',
    );
  }

  const actions: TypeORMPlan['actions'] = [
    {
      type: 'install',
      packages: getDependencies(context),
      devPackages: context.moduleSystem === 'esm' ? ['ts-node'] : [],
    },
  ];

  actions.push({ type: 'env', path: envPath(context), content: buildEnvContent(context) });
  actions.push({
    type: 'create',
    path: databaseConfigPath(context),
    content: buildDatabaseConfigContent(context),
  });
  actions.push({
    type: 'create',
    path: dataSourcePath(context),
    content: buildDataSourceContent(context),
  });

  if (context.typeorm.migrations) {
    actions.push({ type: 'mkdir', path: migrationsDirectory(context) });
    actions.push({
      type: 'modify-package-json',
      path: packageJsonPath(context),
      scripts: { ...buildMigrationScripts(context) },
    });
  }

  actions.push({
    type: 'transform-app-module',
    path: context.nest.appModulePath,
    configImportPath: configImportPathFor(context),
  });

  return { context, actions };
}
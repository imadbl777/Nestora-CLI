import * as path from 'node:path';
import { detectProject } from './project.js';
import { detectPackageManager } from './package-manager.js';
import { detectModuleSystem, type ModuleSystemResult } from './module-system.js';
import type { NestProject } from './project.js';
import { buildContext, type SetupContext } from './context.js';
import { exists } from '../utils/filesystem.js';
import { NestoraError } from '../utils/errors.js';
import { dataSourcePath } from '../utils/typeorm-runner.js';

export interface MigrationProject {
  context: SetupContext;
  project: NestProject;
  moduleSystem: ModuleSystemResult;
  dataSourcePath: string;
}

/**
 * Resolve everything needed to run a `nestora migration:*` command in the
 * current working directory: the project, its module system (CommonJS/ESM),
 * and the TypeORM DataSource path.
 *
 * If the project has not been configured with Nestora — i.e. the DataSource
 * file Nestora generates is missing — a single friendly error points the user
 * at `nestora typeorm` instead of surfacing a confusing TypeORM failure.
 */
export function resolveMigrationProject(dir: string = process.cwd()): MigrationProject {
  const project = detectProject(dir);
  const moduleSystem = detectModuleSystem(project.root);
  const packageManager = detectPackageManager(project.root) ?? 'npm';
  const context = buildContext(
    { project, packageManager, moduleSystem },
    'postgres',
    true,
  );

  const ds = dataSourcePath(context);
  if (!exists(ds)) {
    throw new NestoraError(
      `Nestora could not find a TypeORM DataSource at ${path.relative(project.root, ds).replace(/\\/g, '/')}.\n` +
        'Run: npx nestora typeorm',
    );
  }

  return { context, project, moduleSystem, dataSourcePath: ds };
}

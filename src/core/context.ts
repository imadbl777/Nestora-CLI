import * as path from 'node:path';
import type { NestProject } from './project.js';
import type { PackageManager } from './package-manager.js';
import type { ModuleSystem, ModuleSystemResult } from './module-system.js';

export type DatabaseType = 'postgres' | 'mysql' | 'sqlite';
export type ProjectLayout = 'standard' | 'nx-monorepo';

export interface SetupContext {
  projectRoot: string;
  packageManager: PackageManager;
  moduleSystem: ModuleSystem;

  /** Base command that runs the TypeORM CLI with a TS-aware loader. */
  migrationRunner: string;

  database: {
    type: DatabaseType;
  };

  nest: {
    appModulePath: string;
    layout: ProjectLayout;
    /** Absolute path to the project source root (where app.module.ts lives' dir). */
    sourceRoot: string;
  };

  typeorm: {
    migrations: boolean;
  };
}

export interface DetectionInput {
  project: NestProject;
  packageManager: PackageManager;
  moduleSystem: ModuleSystemResult;
}

export function buildContext(
  input: DetectionInput,
  database: DatabaseType,
  migrations = true,
): SetupContext {
  const sourceRoot = path.dirname(input.project.appModulePath);

  return {
    projectRoot: input.project.root,
    packageManager: input.packageManager,
    moduleSystem: input.moduleSystem.moduleSystem,
    migrationRunner: input.moduleSystem.runner,

    database: { type: database },

    nest: {
      appModulePath: input.project.appModulePath,
      layout: input.project.layout,
      sourceRoot,
    },

    typeorm: { migrations },
  };
}
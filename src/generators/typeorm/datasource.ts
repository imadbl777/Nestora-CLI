import * as path from 'node:path';
import type { SetupContext } from '../../core/context.js';
import {
  DEFAULT_DATABASE,
  databaseTypeLiteral,
  renderTypeORMFile,
} from './templates.js';

export function dataSourceFileName(): string {
  return 'data-source.ts';
}

export function dataSourcePath(context: SetupContext): string {
  return path.join(context.nest.sourceRoot, 'database', dataSourceFileName());
}

export function buildDataSourceContent(context: SetupContext): string {
  return renderTypeORMFile('data-source.ts', {
    databaseType: databaseTypeLiteral(context),
    defaultDatabase: DEFAULT_DATABASE[context.database.type],
    moduleSystem: context.moduleSystem,
  });
}
import type { SetupContext } from '../../core/context.js';
import {
  DEFAULT_DATABASE,
  databaseTypeLiteral,
  renderTypeORMFile,
} from './templates.js';
import { dataSourcePath } from '../../utils/typeorm-runner.js';

export { dataSourcePath };

export function dataSourceFileName(): string {
  return 'data-source.ts';
}

export function buildDataSourceContent(context: SetupContext): string {
  return renderTypeORMFile('data-source.ts', {
    databaseType: databaseTypeLiteral(context),
    defaultDatabase: DEFAULT_DATABASE[context.database.type],
    moduleSystem: context.moduleSystem,
  });
}
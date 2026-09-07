import * as path from 'node:path';
import type { SetupContext } from '../../core/context.js';
import {
  DEFAULT_DATABASE,
  PORT_BY_DATABASE,
  databaseTypeLiteral,
  renderTypeORMFile,
} from './templates.js';

export function databaseConfigFileName(): string {
  return 'database.config.ts';
}

export function databaseConfigPath(context: SetupContext): string {
  return path.join(context.nest.sourceRoot, 'database', databaseConfigFileName());
}

export function buildDatabaseConfigContent(context: SetupContext): string {
  const defaultPort = PORT_BY_DATABASE[context.database.type];
  const defaultDatabase = DEFAULT_DATABASE[context.database.type];

  return renderTypeORMFile('database.config.ts', {
    databaseType: databaseTypeLiteral(context),
    defaultPort,
    defaultDatabase,
  });
}
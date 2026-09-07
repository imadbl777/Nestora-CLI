import * as path from 'node:path';
import type { SetupContext } from '../../core/context.js';
import {
  DEFAULT_DATABASE,
  PORT_BY_DATABASE,
  renderTypeORMFile,
} from './templates.js';

export function buildEnvContent(context: SetupContext): string {
  const defaultPort = PORT_BY_DATABASE[context.database.type];
  const defaultDatabase = DEFAULT_DATABASE[context.database.type];

  return renderTypeORMFile('env', {
    defaultPort,
    defaultDatabase,
  });
}

export function envPath(context: SetupContext): string {
  return path.join(context.projectRoot, '.env');
}
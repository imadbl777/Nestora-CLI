import type { SetupContext } from '../../core/context.js';
import {
  importPathBetween,
} from '../../transformations/app-module.transformer.js';
import { databaseConfigPath } from './config.js';

export function configImportPathFor(context: SetupContext): string {
  const base = importPathBetween(
    context.nest.appModulePath,
    databaseConfigPath(context),
  );
  return context.moduleSystem === 'esm' ? `${base}.js` : base;
}
import * as path from 'node:path';
import * as fs from 'node:fs';
import { renderTemplate, type TemplateVars } from '../../utils/template.js';
import type { SetupContext } from '../../core/context.js';

const TEMPLATES_DIR = path.resolve(__dirname, '../../../templates/typeorm');

export function renderTypeORMFile(
  file: string,
  vars: TemplateVars,
): string {
  const templatePath = path.join(TEMPLATES_DIR, file);
  const template = fs.readFileSync(templatePath, 'utf8');
  // Normalize CRLF -> LF so generated files never carry the line endings of
  // the checkout (git autocrlf can check templates out as CRLF on Windows).
  return renderTemplate(template.replace(/\r\n/g, '\n'), vars);
}

export const PORT_BY_DATABASE: Record<string, string> = {
  postgres: '5432',
  mysql: '3306',
  sqlite: '',
};

export const DEFAULT_DATABASE: Record<string, string> = {
  postgres: 'postgres',
  mysql: 'nestora',
  sqlite: 'database.sqlite',
};

export function databaseTypeLiteral(context: SetupContext): string {
  return context.database.type === 'sqlite' ? 'better-sqlite3' : context.database.type;
}
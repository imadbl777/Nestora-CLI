import type { SetupContext, DatabaseType } from '../../core/context.js';
import { NestoraError } from '../../utils/errors.js';

const DATABASE_PACKAGES: Record<DatabaseType, string[]> = {
  postgres: ['@nestjs/typeorm', 'typeorm', 'pg'],
  mysql: ['@nestjs/typeorm', 'typeorm', 'mysql2'],
  sqlite: ['@nestjs/typeorm', 'typeorm', 'better-sqlite3'],
};

/**
 * Packages to install so a generated project can actually run:
 * the Nest/TypeORM core, the selected driver, and `dotenv` (the generated
 * config/data-source files call `import 'dotenv/config'`, so `dotenv` must
 * be a real dependency, not just a dev-time convenience).
 */
export function getDependencies(context: SetupContext): string[] {
  const packages = DATABASE_PACKAGES[context.database.type];
  if (!packages) {
    throw new NestoraError(`Unsupported database type: ${context.database.type}`);
  }
  return [...packages, 'dotenv'];
}
import { select } from '@inquirer/prompts';
import type { DatabaseType } from '../core/context.js';

const DATABASE_CHOICES: Array<{ name: string; value: DatabaseType }> = [
  { name: 'PostgreSQL', value: 'postgres' },
  { name: 'MySQL', value: 'mysql' },
  { name: 'SQLite', value: 'sqlite' },
];

const DATABASE_ALIASES: Record<string, DatabaseType> = {
  postgres: 'postgres',
  postgresql: 'postgres',
  pg: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
  sqlite: 'sqlite',
  sqlite3: 'sqlite',
};

export interface TypeORMPromptResult {
  database: DatabaseType;
  migrations: boolean;
}

export async function promptForDatabase(): Promise<DatabaseType> {
  return select({
    message: 'Which database do you want to use?',
    choices: DATABASE_CHOICES,
  });
}

export async function promptTypeORMSetup(): Promise<TypeORMPromptResult> {
  const envDatabase = process.env.NESTORA_DATABASE;
  if (envDatabase && envDatabase in DATABASE_ALIASES) {
    return {
      database: DATABASE_ALIASES[envDatabase],
      migrations: process.env.NESTORA_MIGRATIONS !== 'false',
    };
  }

  const database = await promptForDatabase();
  const migrations = await select({
    message: 'Set up TypeORM migrations?',
    choices: [
      { name: 'Yes', value: true },
      { name: 'No, skip migrations', value: false },
    ],
  });

  return { database, migrations };
}
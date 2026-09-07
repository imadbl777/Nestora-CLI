import 'dotenv/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(
      `Missing required environment variable: ${name}.\n` +
        'Set it in your .env file (or the environment) before starting the app.',
    );
  }
  return value;
}

export const databaseConfig: TypeOrmModuleOptions = {
  type: '{{databaseType}}',
{% if databaseType === 'better-sqlite3' %}
  database: process.env.DB_DATABASE ?? 'database.sqlite',
{% else %}
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '{{defaultPort}}', 10),
  username: requiredEnv('DB_USERNAME'),
  password: requiredEnv('DB_PASSWORD'),
  database: process.env.DB_DATABASE ?? '{{defaultDatabase}}',
{% endif %}
  autoLoadEntities: true,
  synchronize: false,
};
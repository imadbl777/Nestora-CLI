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

// Entity globs are switched based on the environment: src/** patterns at
// dev time (ts-node / tsx) and dist/** patterns once the app is compiled and
// deployed. Any file named *.entity.ts under the source root is picked up
// automatically, so adding an entity needs no further registration here.
{% if moduleSystem === 'esm' %}
const isBuilt = import.meta.url.includes('dist');
{% else %}
const isBuilt = __dirname.includes('dist');
{% endif %}
const entities = isBuilt ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts';

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
  entities: [entities],
  autoLoadEntities: true,
  synchronize: false,
};
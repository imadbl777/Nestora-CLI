import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

// TypeORM DataSource for the TypeORM CLI and migrations.
//
// Globs are switched based on the environment: src/** patterns at dev time
// (ts-node / tsx) and dist/** patterns once the app is compiled and deployed.
{% if moduleSystem === 'esm' %}
const isBuilt = import.meta.url.includes('dist');
{% else %}
const isBuilt = __dirname.includes('dist');
{% endif %}
const entitiesGlob = isBuilt ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts';
const migrationsGlob = isBuilt
  ? 'dist/database/migrations/*.js'
  : 'src/database/migrations/*.ts';

export default new DataSource({
  type: '{{databaseType}}',
{% if databaseType === 'better-sqlite3' %}
  database: process.env.DB_DATABASE ?? 'database.sqlite',
{% else %}
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
{% endif %}
  entities: [entitiesGlob],
  migrations: [migrationsGlob],
  synchronize: false,
});
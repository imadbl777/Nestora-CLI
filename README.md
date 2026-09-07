# Nestora

A CLI that configures common integrations inside an **existing NestJS project**.

```sh
npx nestora typeorm
```

Run inside your NestJS project and Nestora detects the environment, asks a
couple of questions, and wires up TypeORM end-to-end: dependencies, `.env`
variables, database config, a TypeORM `DataSource`, migration scripts, and a
`TypeOrmModule.forRoot(...)` registration in your `app.module.ts`.

## Features

- **Project detection** — standard NestJS layouts **and Nx monorepos**
  (`apps/*/src/...`).
- **Package-manager detection** — npm, pnpm, yarn, bun (lockfile based).
- **Module-system detection** — generates the right migration runner for CommonJS
  vs. ESM projects (`typeorm-ts-node-commonjs` vs. `typeorm-ts-node-esm`).
- **Databases** — PostgreSQL, MySQL, SQLite.
- **AST-based edit** of `app.module.ts` via `ts-morph`, with a Prettier pass that
  respects the target project's own Prettier config.
- **Idempotent** — running the command twice does not duplicate configuration.
- **Plan → confirm → execute** flow, so you see every change before it's applied.
- **Validation** — verifies the result files, then runs the project's own build
  script as a compile check (soft-warned if no `build` script exists).
- **Migration commands** — `nestora migration:generate|run|revert|show` run the
  TypeORM CLI with zero configuration: the DataSource path and the
  CommonJS/ESM runner (`typeorm-ts-node-commonjs` vs `typeorm-ts-node-esm`)
  are resolved from the target project automatically.

## Usage

```sh
cd my-nestjs-app
npx nestora typeorm
```

Follow the prompts: choose a database and whether to set up migrations.

### Non-interactive flags / env vars

| Env var                  | Purpose                                            |
|--------------------------|----------------------------------------------------|
| `NESTORA_DATABASE`     | `postgres`, `mysql`, or `sqlite` (skips prompt)    |
| `NESTORA_MIGRATIONS`   | `false` to skip migrations                         |
| `NESTORA_YES`          | `1` to skip the final confirmation                 |
| `NESTORA_RECONFIGURE`  | `keep` / `reconfigure` / `abort` when already set  |

## What it generates

For PostgreSQL (example):

```
src/database/database.config.ts   # NestJS runtime config (TypeOrmModuleOptions)
src/database/data-source.ts       # TypeORM CLI / migration DataSource
src/database/migrations/          # migrations directory
.env                              # DB_HOST / DB_PORT / DB_USERNAME / ...
package.json                      # typeorm + migration:* scripts
src/app.module.ts                 # TypeOrmModule.forRoot(databaseConfig)
```

Installed packages map per database (`dotenv` is added so the generated
`.env` file is actually loaded, and `ts-node` is added on top for ESM
projects, where modern NestJS scaffolds no longer ship it but the
`typeorm-ts-node-esm` runner needs it):

| Database   | Packages                                                     |
|------------|--------------------------------------------------------------|
| PostgreSQL | `@nestjs/typeorm`, `typeorm`, `pg`, `dotenv`                 |
| MySQL      | `@nestjs/typeorm`, `typeorm`, `mysql2`, `dotenv`             |
| SQLite     | `@nestjs/typeorm`, `typeorm`, `better-sqlite3`, `dotenv`     |

### Generated migration scripts

Nestora adds a `typeorm` script plus `migration:generate`, `migration:run`
and `migration:revert` (via `typeorm-ts-node-commonjs` or
`typeorm-ts-node-esm`, matching the project's module system):

```sh
# generate a migration by diffing your entities against the database:
npm run migration:generate -- src/database/migrations/TodoItem

# apply pending migrations:
npm run migration:run
# npm run migration:revert
```

The generate command takes a positional path (not an env variable), so it works
identically on Windows, macOS, and Linux shells.

## Migrations, the nestora way

You never need to remember the DataSource path or the ts-node runner. Nestora
wraps the TypeORM CLI with four commands that resolve both automatically from
your project:

```sh
npx nestora migration:generate CreateTodos    # diff entities vs DB -> new migration
npx nestora migration:run                     # apply pending migrations
npx nestora migration:revert                  # revert the last executed migration
npx nestora migration:show                    # list applied and pending migrations
```

Compared to the raw npm scripts, the nestora commands map one-to-one:

| What you want      | Raw (npm script)                              | Nestora                    |
|--------------------|-----------------------------------------------|----------------------------|
| Generate           | `npm run migration:generate -- src/database/migrations/CreateTodos` | `npx nestora migration:generate CreateTodos` |
| Apply              | `npm run migration:run`                       | `npx nestora migration:run` |
| Revert             | `npm run migration:revert`                    | `npx nestora migration:revert` |
| List               | (no npm script)                               | `npx nestora migration:show` |

`migration:generate` takes only the migration **name** — no DataSource flag and
no path. The name is used verbatim as the output path after the timestamp
(`<timestamp>-<Name>.ts`) and becomes the TypeScript migration class name, so
`CreateTodos`, `create-todos` and `create_todos` all work. The migrations
directory is created automatically if missing.

> **How generate works:** it diffs **all** entities under `src/**/*.entity.ts`
> against your database. The table(s) in the generated SQL come from your
> entities — the name you pass is only the filename/class. On a fresh database,
> the first generate captures every entity you've written so far. Nestora no
> longer ships a demo entity, so nothing you didn't create ends up in a
> migration.

### Entities → migrations

```
src/todos/todo.entity.ts                  define the shape of your data
        │
        ▼
npx nestora migration:generate CreateTodos     diff entities against the DB
        ▼
src/database/migrations/<ts>-CreateTodos.ts    a snapshot of that change (up + down)
        │
        ▼
npx nestora migration:run                     apply it to the database
```

Entities describe *what* your data looks like; migrations capture *how the
schema changed over time* (including the `down()` to undo a change). Nestora
wires `synchronize: false` in `database.config.ts`, so schema updates are always
reviewable migration files instead of silent runtime changes.

If the DataSource is missing (e.g. you cloned the repo and ran a migration
command before `nestora typeorm`), you get a friendly hint instead of a raw
TypeORM error:

```
[error] Nestora could not find a TypeORM DataSource at src/database/data-source.ts.
Run: npx nestora typeorm
```

### Entities

Both the generated `data-source.ts` (used by the TypeORM CLI) and
`database.config.ts` (used by the NestJS runtime) load entities automatically
via a glob: `src/**/*.entity.ts` in development and `dist/**/*.entity.js` after
a build. So **you never have to register an entity in two places** — drop a new
`*.entity.ts` anywhere under `src/` and it is picked up by both migrations and
the running app.

Nestora does not scaffold a demo entity, so `migration:generate` only ever
diffs what *you* have written. To take an entity to the database:

```ts
// src/todos/todo.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('todos')
export class Todo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ default: false })
  done: boolean;
}
```

```sh
npx nestora migration:generate CreateTodos   # -> CREATE TABLE "todos" (...)
npx nestora migration:run
```

## Development

```sh
npm run build    # compile src -> dist
npm run dev      # run via tsx (src/index.ts)
npm test         # unit + integration tests (integration is opt-in, see below)
```

> Note: `npm run dev` uses `tsx` (esbuild) for speed, but esbuild cannot emit
> TypeScript decorator metadata — the `typeorm-ts-node-*` runner generated for
> target projects is ts-node based. For behavior that matches the released
> CLI exactly, run `node dist/index.js` after `npm run build`.

### Tests

- **Unit** — plan builder, AST transformer (empty / populated / missing imports /
  already-configured fixtures), template renderer, project / package-manager /
  module-system detection, migration command/runner builders and error mapping.
- **Integration** — scaffolds a real NestJS project into a temp dir, runs the
  CLI end-to-end against it (CommonJS **and** ESM fixtures), asserts it still
  compiles, and asserts a second run is a no-op. It then exercises the full
  migration lifecycle through the CLI — `migration:generate CreateTodos`,
  `migration:show`, `migration:run`, `migration:revert` — against SQLite.
  Opt-in because it installs npm packages:

```sh
# Unix (bash / zsh):
npm run build
RUN_E2E=1 npx vitest run test/integration/typeorm-e2e.spec.ts

# Windows (cmd.exe):
npm run build
set RUN_E2E=1&& npx vitest run test/integration/typeorm-e2e.spec.ts

# Windows (PowerShell):
npm run build
$env:RUN_E2E='1'; npx vitest run test/integration/typeorm-e2e.spec.ts
```

## Architecture

The CLI is a tool, not a NestJS application. Layering:

```
CLI (commander) → Command (coordinator) → Prompts (Inquirer)
      ↓
Detection (project / package-manager / module-system) → SetupContext
      ↓
TypeORM plan builder → plan → confirm → execute
      ↓
Validation (file checks + build)
```

Generators never import Inquirer directly, keeping them unit-testable without a
TTY. See `Nestora-architecture.md` for the full reference.
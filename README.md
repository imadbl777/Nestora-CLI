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
```

The generate command takes a positional path (not an env variable), so it works
identically on Windows, macOS, and Linux shells.

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
  module-system detection.
- **Integration** — scaffolds a real NestJS project into a temp dir, runs the
  CLI end-to-end against it, asserts it still compiles, and asserts a second run
  is a no-op. Opt-in because it installs npm packages:

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
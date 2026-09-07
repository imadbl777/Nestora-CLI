import * as path from 'node:path';
import { exists, readJson } from '../utils/filesystem.js';
import { run } from '../utils/shell.js';
import { logger } from '../utils/logger.js';
import type { SetupContext } from '../core/context.js';
import { databaseConfigPath, dataSourcePath, migrationsDirectory } from '../generators/typeorm/index.js';
import type { PackageJson } from '../core/project.js';

export interface ValidationReport {
  ok: boolean;
  checks: Array<{ name: string; passed: boolean; soft?: boolean }>;
}

export function typeormIsInstalled(context: SetupContext): boolean {
  const pkg = readJson<PackageJson>(context.projectRoot + '/package.json');
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return 'typeorm' in all && '@nestjs/typeorm' in all;
}

export function validateSetup(context: SetupContext): ValidationReport {
  const checks: ValidationReport['checks'] = [];

  checks.push({
    name: 'TypeORM packages in package.json',
    passed: typeormIsInstalled(context),
  });

  checks.push({
    name: 'database/database.config.ts exists',
    passed: exists(databaseConfigPath(context)),
  });

  checks.push({
    name: 'database/data-source.ts exists',
    passed: exists(dataSourcePath(context)),
  });

  if (context.typeorm.migrations) {
    checks.push({
      name: 'migrations directory exists',
      passed: exists(migrationsDirectory(context)),
    });
  }

  const appModuleContent = require('node:fs').readFileSync(context.nest.appModulePath, 'utf8');
  checks.push({
    name: 'AppModule registers TypeOrmModule',
    passed: /TypeOrmModule\.forRoot/.test(appModuleContent),
  });

  const ok = checks.every((c) => c.passed);
  return { ok, checks };
}

/**
 * Attempt a compile check via the project's own build script.
 * Missing build script -> soft warning, not a hard failure.
 */
const BUILD_TIMEOUT_MS = 180_000;

export function runBuildCheck(context: SetupContext): ValidationReport {
  const checks: ValidationReport['checks'] = [];

  const pkg = readJson<PackageJson>(path.join(context.projectRoot, 'package.json'));
  const scripts = pkg.scripts ?? {};
  const buildScript = scripts.build;

  if (!buildScript) {
    logger.warn("Couldn't find a `build` script to validate against — skipping compile check.");
    checks.push({ name: 'build compile', passed: true, soft: true });
    return { ok: true, checks };
  }

  logger.step('Running build to validate compilation...');
  const args = buildCommandArgs(context.packageManager);
  const result = run(args[0], args.slice(1), {
    cwd: context.projectRoot,
    stdio: 'pipe',
    timeout: BUILD_TIMEOUT_MS,
  });

  const passed = result.status === 0;
  checks.push({ name: 'build compile', passed });

  if (passed) {
    return { ok: passed, checks };
  }

  if (result.error?.code === 'ETIMEDOUT') {
    logger.error(
      `Build timed out after ${BUILD_TIMEOUT_MS / 1000}s and was killed.`,
    );
  } else if (result.error) {
    logger.error(`Build could not start: ${result.error.message}`);
  } else {
    logger.error('Build failed. Captured output:');
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  if (output) {
    const tail =
      output.length > 10_000
        ? `(showing the last 10000 characters)\n${output.slice(-10_000)}`
        : output;
    process.stderr.write(`${tail}\n`);
  } else {
    logger.error('(no output captured from the build command)');
  }

  return { ok: passed, checks };
}

function buildCommandArgs(packageManager: string): string[] {
  switch (packageManager) {
    case 'npm':
    case 'pnpm':
    case 'bun':
      return [packageManager, 'run', 'build'];
    case 'yarn':
      return ['yarn', 'build'];
    default:
      return ['npm', 'run', 'build'];
  }
}

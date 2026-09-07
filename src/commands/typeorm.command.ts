import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { confirm, select } from '@inquirer/prompts';
import { detectProject } from '../core/project.js';
import { detectPackageManager } from '../core/package-manager.js';
import { detectModuleSystem } from '../core/module-system.js';
import { buildContext } from '../core/context.js';
import { promptTypeORMSetup } from '../prompts/typeorm.prompt.js';
import {
  checkExistingSetup,
  createTypeORMPlan,
} from '../generators/typeorm/index.js';
import { describePlan } from '../generators/typeorm/plan.js';
import { executePlan } from '../executor/plan-executor.js';
import { runBuildCheck, validateSetup } from '../validation/setup-validation.js';
import { logger } from '../utils/logger.js';
import {
  AlreadyConfiguredError,
  NestoraError,
  AbortedError,
} from '../utils/errors.js';

export const typeormCommand = new Command('typeorm')
  .description('Configure TypeORM with a database of your choice.')
  .option('-y, --yes', 'skip confirmation and use defaults')
  .action(async (options: { yes?: boolean }) => {
    try {
      await runTypeORMSetup(options.yes ?? false);
    } catch (error) {
      handleError(error);
    }
  });

export async function runTypeORMSetup(assumeYes: boolean): Promise<void> {
  logger.step('Detecting project...');
  const project = detectProject();

  logger.step('Detecting package manager...');
  const packageManager = detectPackageManager(project.root) ?? 'npm';

  logger.step('Detecting module system...');
  const moduleSystem = detectModuleSystem(project.root);

  logger.info(
    `Found ${project.layout === 'nx-monorepo' ? 'Nx monorepo' : 'NestJS'} project (${packageManager}, ${moduleSystem.moduleSystem}).`,
  );

  const prompts = await promptTypeORMSetup();

  const context = buildContext(
    { project, packageManager, moduleSystem },
    prompts.database,
    prompts.migrations,
  );

  const existing = checkExistingSetup(context);
  if (existing === 'complete') {
    await handleAlreadyConfigured(context);
    return;
  }

  const plan = createTypeORMPlan(context);

  logger.info('\nThe following changes will be made:');
  for (const line of describePlan(plan)) {
    logger.success(line);
  }

  const autoConfirm =
    assumeYes || process.env.NESTORA_YES === '1' || process.env.NESTORA_YES === 'true';

  if (!autoConfirm) {
    const proceed = await confirm({
      message: 'Continue?',
      default: true,
    });
    if (!proceed) throw new AbortedError();
  }

  await executePlan(plan);

  const report = validateSetup(context);
  for (const check of report.checks) {
    if (check.passed) logger.success(check.name);
    else logger.error(check.name);
  }

  if (!report.ok) {
    throw new NestoraError(
      'TypeORM configuration failed validation.\nYour project was not modified further.',
    );
  }

  const build = runBuildCheck(context);
  if (!build.ok) {
    throw new NestoraError(
      'TypeORM configuration failed validation (compile check failed).',
    );
  }

  logger.success('\nTypeORM configured successfully.');
}

/**
 * Present the "already configured" menu (keep / reconfigure / abort).
 * Reconconfigured files are deleted only after the user confirms, so an
 * abort never leaves the project half-deleted.
 * Exported so the flow can be tested without a TTY.
 */
export async function handleAlreadyConfigured(context: ReturnType<typeof buildContext>): Promise<void> {
  const envChoice = process.env.NESTORA_RECONFIGURE;
  const action =
    envChoice && ['keep', 'reconfigure', 'abort'].includes(envChoice)
      ? envChoice
      : await select({
          message: 'TypeORM is already configured. What do you want to do?',
          choices: [
            { name: 'Keep existing configuration', value: 'keep' },
            { name: 'Reconfigure', value: 'reconfigure' },
            { name: 'Abort', value: 'abort' },
          ],
        });

  if (action === 'keep' || action === 'abort') {
    if (action === 'keep') logger.info('TypeORM is already configured. Nothing changed.');
    else throw new AbortedError();
    return;
  }

  // Reconfigure: build and show the plan first, then confirm. Existing files
  // are only removed AFTER the user confirms, so aborting never leaves the
  // project half-deleted.
  const plan = createTypeORMPlan(context, { force: true });
  logger.info('\nReconfiguring TypeORM:');
  for (const line of describePlan(plan)) {
    logger.success(line);
  }

  const proceed = await confirm({ message: 'Continue?', default: true });
  if (!proceed) throw new AbortedError();

  const filesToRemove = [
    path.join(context.nest.sourceRoot, 'database', 'database.config.ts'),
    path.join(context.nest.sourceRoot, 'database', 'data-source.ts'),
  ];
  for (const file of filesToRemove) {
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }

  await executePlan(plan);
  logger.success('TypeORM reconfigured.');
}

/**
 * Map any error thrown during setup to a CLI message and exit code.
 * Expected failures (NestoraError family) print their message only;
 * unexpected errors also print the stack so they stay diagnosable even
 * without NESTORA_DEBUG.
 * Exported so the mapping can be tested without invoking a TTY command.
 */
export function handleError(error: unknown): void {
  if (error instanceof AlreadyConfiguredError) {
    logger.warn(error.message);
    process.exitCode = 0;
    return;
  }
  if (error instanceof AbortedError) {
    logger.info(error.message);
    process.exitCode = error.exitCode;
    return;
  }
  if (error instanceof NestoraError) {
    logger.error(error.message);
    process.exitCode = error.exitCode ?? 1;
    return;
  }
  if (error instanceof Error) {
    logger.error(error.stack ?? error.message);
  } else {
    logger.error(String(error));
  }
  process.exitCode = 1;
}

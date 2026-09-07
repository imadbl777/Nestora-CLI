import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../utils/logger.js';
import { readJson, writeFile, ensureDirectory } from '../utils/filesystem.js';
import { installPackages } from '../utils/shell.js';
import { NestoraError } from '../utils/errors.js';
import { relativeToProjectRoot } from '../utils/paths.js';
import { transformAppModule } from '../transformations/app-module.transformer.js';
import type { PlanAction, TypeORMPlan } from '../generators/typeorm/plan.js';

export interface ExecutionReport {
  actions: number;
}

export async function executePlan(plan: TypeORMPlan): Promise<ExecutionReport> {
  let executed = 0;

  for (const action of plan.actions) {
    await applyAction(action, plan);
    executed += 1;
  }

  return { actions: executed };
}

async function applyAction(action: PlanAction, plan: TypeORMPlan): Promise<void> {
  switch (action.type) {
    case 'install': {
      installPackages(plan.context.packageManager, action.packages, plan.context.projectRoot);
      if (action.devPackages?.length) {
        installPackages(
          plan.context.packageManager,
          action.devPackages,
          plan.context.projectRoot,
          true,
        );
      }
      logger.success(
        `Installed ${[...action.packages, ...(action.devPackages ?? [])].join(', ')}`,
      );
      return;
    }

    case 'mkdir': {
      ensureDirectory(action.path);
      logger.success(`Created directory ${relative(plan, action.path)}`);
      return;
    }

    case 'create': {
      writeFile(action.path, action.content);
      logger.success(`Created ${relative(plan, action.path)}`);
      return;
    }

    case 'env': {
      const existing = fs.existsSync(action.path) ? fs.readFileSync(action.path, 'utf8') : '';
      const created = existing === '';
      const merged = mergeEnv(existing, action.content);
      writeFile(action.path, merged);
      logger.success(`${created ? 'Created' : 'Updated'} ${relative(plan, action.path)}`);
      return;
    }

    case 'modify-package-json': {
      const pkg = readJson<Record<string, any>>(action.path);
      pkg.scripts = { ...(pkg.scripts ?? {}), ...action.scripts };
      writeFile(action.path, JSON.stringify(pkg, null, 2) + '\n');
      logger.success(`Added migration scripts to ${relative(plan, action.path)}`);
      return;
    }

    case 'transform-app-module': {
      const result = await transformAppModule({
        appModulePath: action.path,
        configImportPath: action.configImportPath,
        projectRoot: plan.context.projectRoot,
      });
      if (result.alreadyConfigured) {
        logger.warn('AppModule already registers TypeOrmModule — skipped.');
      } else {
        logger.success(`Registered TypeOrmModule in ${relative(plan, action.path)}`);
      }
      return;
    }

    default:
      throw new NestoraError(`Unknown plan action type.`);
  }
}

function relative(plan: TypeORMPlan, target: string): string {
  return relativeToProjectRoot(plan.context.projectRoot, target);
}

/**
 * Merge new `KEY=value` lines into an existing `.env` payload. Existing keys
 * are preserved (their values win); only new keys are appended. Comment lines
 * and blank lines from the additions are appended as-is.
 */
export function mergeEnv(existing: string, additions: string): string {
  const existingKeys = new Set<string>();
  for (const line of existing.split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) existingKeys.add(match[1]);
  }

  // Keep lines from the additions that are not already-set keys. Empty lines
  // (which arise from a trailing newline in the template) and comment/blank
  // decorations are dropped so nothing stray gets appended.
  const newLines: string[] = [];
  for (const line of additions.split('\n')) {
    const keyMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (keyMatch && existingKeys.has(keyMatch[1])) continue;
    if (line === '') continue;
    newLines.push(line);
  }

  if (newLines.length === 0) return existing;
  const joined = newLines.join('\n');
  return existing === ''
    ? joined + '\n'
    : existing.endsWith('\n')
      ? existing + joined + '\n'
      : existing + '\n' + joined + '\n';
}
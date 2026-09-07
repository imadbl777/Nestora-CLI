import * as path from 'node:path';
import { exists } from '../utils/filesystem.js';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const LOCKFILE_MAP: Array<[string, PackageManager]> = [
  ['package-lock.json', 'npm'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
];

export function detectPackageManager(
  projectRoot: string,
): PackageManager | null {
  for (const [file, manager] of LOCKFILE_MAP) {
    if (exists(path.join(projectRoot, file))) return manager;
  }
  return null;
}

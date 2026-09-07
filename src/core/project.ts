import * as path from 'node:path';
import { exists, isDirectory, readJson } from '../utils/filesystem.js';
import { NotANestProjectError } from '../utils/errors.js';

export interface PackageJson {
  name?: string;
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export type ProjectLayout = 'standard' | 'nx-monorepo';

export interface NestProject {
  root: string;
  appModulePath: string;
  layout: ProjectLayout;
}

interface NestCliJson {
  sourceRoot?: string;
}

export function findPackageJson(startDir: string): string | null {
  let current = startDir;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (exists(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function hasNestCore(packageJsonPath: string): boolean {
  try {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const all = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    return '@nestjs/core' in all;
  } catch {
    return false;
  }
}

function isNxWorkspace(root: string): boolean {
  return exists(path.join(root, 'nx.json'));
}

/** Resolve the app-source directory for a given layout. */
function resolveAppSource(cwd: string, root: string, layout: ProjectLayout): string {
  if (layout === 'standard') {
    const nestCliJsonPath = path.join(root, 'nest-cli.json');
    if (exists(nestCliJsonPath)) {
      try {
        const nestCli = readJson<NestCliJson>(nestCliJsonPath);
        if (nestCli.sourceRoot) {
          const fromCij = path.join(root, nestCli.sourceRoot);
          if (isDirectory(fromCij)) return fromCij;
        }
      } catch {
        // fall through
      }
    }
    return path.join(root, 'src');
  }

  // Nx monorepo — inspect apps/
  const appsDir = path.join(root, 'apps');
  if (isDirectory(appsDir)) {
    const apps = require('node:fs')
      .readdirSync(appsDir, { withFileTypes: true })
      .filter((e: { isDirectory: () => boolean }) => e.isDirectory())
      .map((e: { name: string }) => e.name);

    // Prefer an app that contains the current working directory.
    for (const app of apps) {
      const candidate = path.join(root, 'apps', app);
      if (
        (cwd === candidate || cwd.startsWith(candidate + path.sep)) &&
        isDirectory(path.join(candidate, 'src'))
      ) {
        return path.join(candidate, 'src');
      }
    }
    // Fall back to the first app with a src dir.
    for (const app of apps) {
      const candidate = path.join(root, 'apps', app);
      if (isDirectory(path.join(candidate, 'src'))) {
        return path.join(candidate, 'src');
      }
    }
  }

  return path.join(root, 'src');
}

export function detectProject(startDir: string = process.cwd()): NestProject {
  const cwd = path.resolve(startDir);
  const packageJsonPath = findPackageJson(cwd);
  if (!packageJsonPath) {
    throw new NotANestProjectError(
      'This command must be executed inside a NestJS project.',
    );
  }

  if (!hasNestCore(packageJsonPath)) {
    throw new NotANestProjectError(
      'This command must be executed inside a NestJS project (@nestjs/core not found).',
    );
  }

  const root = path.dirname(packageJsonPath);
  const layout: ProjectLayout = isNxWorkspace(root) ? 'nx-monorepo' : 'standard';
  const sourceRoot = resolveAppSource(cwd, root, layout);

  const appModulePath = path.join(sourceRoot, 'app.module.ts');
  if (!exists(appModulePath)) {
    throw new NotANestProjectError(
      `Could not locate app.module.ts under "${sourceRoot}".`,
    );
  }

  return {
    root,
    appModulePath,
    layout,
  };
}

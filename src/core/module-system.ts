import * as path from 'node:path';
import { exists, isDirectory, readFile } from '../utils/filesystem.js';

export type ModuleSystem = 'commonjs' | 'esm';

export interface ModuleSystemResult {
  moduleSystem: ModuleSystem;
  /**
   * Base command that runs the TypeORM CLI with a TypeScript-aware loader.
   *
   * - CJS: `typeorm-ts-node-commonjs`
   * - ESM: `typeorm-ts-node-esm`
   *
   * The ts-node wrapper bins ship with typeorm and emit real decorator
   * metadata (esbuild-based loaders like tsx cannot emit `design:type`, which
   * breaks `migration:generate` for entities using inferred column types).
   * ts-node itself is added to the project's dependencies for ESM, where
   * modern (Vite-based) NestJS scaffolds no longer include it.
   */
  runner: 'typeorm-ts-node-commonjs' | 'typeorm-ts-node-esm';
}

/**
 * Detect whether the target project is CommonJS or ESM.
 *
 * The `"type"` field in package.json is the primary signal and wins over the
 * tsconfig: `"type": "module"` -> ESM, `"type": "commonjs"` -> CommonJS.
 * Only when the field is absent do we fall back to the `module` compiler
 * option in tsconfig.json (anything that is not CommonJS counts as ESM).
 *
 * Real-world tsconfigs use JSONC comments and `extends` (relative or npm
 * package style); both are handled so genuine ESM projects aren't
 * misclassified as CommonJS (which would generate a `__dirname`-based
 * data-source that breaks under the ESM runner).
 */
export function detectModuleSystem(projectRoot: string): ModuleSystemResult {
  const type = readPackageType(projectRoot);

  const isEsm =
    type === 'module' || (type === undefined && tsconfigIsEsm(projectRoot));

  return isEsm
    ? {
        moduleSystem: 'esm',
        runner: 'typeorm-ts-node-esm',
      }
    : {
        moduleSystem: 'commonjs',
        runner: 'typeorm-ts-node-commonjs',
      };
}

function readPackageType(projectRoot: string): string | undefined {
  try {
    const pkg = JSON.parse(readFile(path.join(projectRoot, 'package.json')));
    return pkg.type;
  } catch {
    return undefined;
  }
}

function tsconfigIsEsm(projectRoot: string): boolean {
  const compilerOptions = readCompilerOptions(projectRoot, 'tsconfig.json');
  const moduleValue = compilerOptions?.module;
  if (!moduleValue) {
    return false;
  }
  // CommonJS and the node* module modes only emit ESM when package.json
  // carries "type": "module" — which is already handled above. Without it,
  // "nodenext"/"node16" resolve to CommonJS, so they are NOT ESM.
  const normalized = moduleValue.toLowerCase();
  return !['commonjs', 'node16', 'nodenext'].includes(normalized);
}

function readCompilerOptions(
  baseDir: string,
  fileName: string,
  seen: Set<string> = new Set(),
): { module?: string } | undefined {
  const fullPath = path.resolve(baseDir, fileName);
  if (seen.has(fullPath) || !exists(fullPath)) {
    return undefined;
  }
  seen.add(fullPath);

  let raw: unknown;
  try {
    // tsconfig.json is JSONC (allows comments); strip them before parsing.
    raw = JSON.parse(stripJsonComments(readFile(fullPath)));
  } catch {
    return undefined;
  }

  const config = raw as {
    extends?: string;
    compilerOptions?: { module?: string };
  };
  const own = config.compilerOptions ?? {};

  if (typeof config.extends === 'string') {
    const base = resolveExtends(fullPath, config.extends);
    if (base) {
      const inherited = readCompilerOptions(path.dirname(base), path.basename(base), seen);
      return { ...(inherited ?? {}), ...own };
    }
  }

  return own;
}

function resolveExtends(fromFile: string, extendsValue: string): string | null {
  if (extendsValue.startsWith('.')) {
    // Relative to the tsconfig that declares the extends.
    let target = path.resolve(path.dirname(fromFile), extendsValue);
    if (exists(target) && isDirectory(target)) {
      target = path.join(target, 'tsconfig.json');
    }
    if (!target.endsWith('.json') && !exists(target)) {
      target += '.json';
    }
    return exists(target) ? target : null;
  }

  // npm-package style ("@scope/name" or "@scope/name/sub/path"), resolved via
  // node_modules starting at the tsconfig and walking up.
  const segments = extendsValue.split('/');
  const packageName =
    segments[0].startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
  const subPath = segments
    .slice(packageName.startsWith('@') ? 2 : 1)
    .join('/');

  let dir = path.dirname(fromFile);
  while (true) {
    const packageRoot = path.join(dir, 'node_modules', packageName);
    if (exists(packageRoot)) {
      let target = path.join(packageRoot, subPath);
      if (subPath === '') {
        target = path.join(packageRoot, 'tsconfig.json');
      } else if (!exists(target) && !subPath.endsWith('.json')) {
        target += '.json';
      }
      if (exists(target) && isDirectory(target)) {
        target = path.join(target, 'tsconfig.json');
      }
      return exists(target) ? target : null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Remove `//` and `/* ... *\/` comments from tsconfig JSONC text, keeping
 * string literals intact (so values like URLs or glob paths that contain
 * slashes are untouched).
 */
function stripJsonComments(source: string): string {
  let out = '';
  let i = 0;
  let inString: '"' | "'" | null = null;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === '/')
      ) {
        i += 1;
      }
      i += 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}
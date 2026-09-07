import * as path from 'node:path';

/**
 * Render a file path for human-facing output (plan descriptions and execution
 * logs), relative to the project root. Falls back to the absolute target when
 * it lives outside the root. Forward slashes are used for consistent output
 * across platforms.
 */
export function relativeToProjectRoot(root: string, target: string): string {
  const rel = path.relative(root, target).replace(/\\/g, '/');
  return rel || target;
}
import * as fs from 'node:fs';
import * as path from 'node:path';

export function exists(targetPath: string): boolean {
  return fs.existsSync(targetPath);
}

export function readFile(targetPath: string): string {
  return fs.readFileSync(targetPath, 'utf8');
}

export function readJson<T = Record<string, unknown>>(targetPath: string): T {
  return JSON.parse(readFile(targetPath)) as T;
}

export function writeFile(targetPath: string, content: string): void {
  ensureDirectory(path.dirname(targetPath));
  fs.writeFileSync(targetPath, content, 'utf8');
}

export function ensureDirectory(dirPath: string): void {
  if (exists(dirPath)) return;
  fs.mkdirSync(dirPath, { recursive: true });
}

export function isDirectory(targetPath: string): boolean {
  return exists(targetPath) && fs.statSync(targetPath).isDirectory();
}

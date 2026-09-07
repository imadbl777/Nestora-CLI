import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Project,
  SyntaxKind,
  type Node,
  type ObjectLiteralExpression,
} from 'ts-morph';
import { resolveConfig, format } from 'prettier';
import { logger } from '../utils/logger.js';
import { NestoraError } from '../utils/errors.js';

export interface TransformResult {
  changed: boolean;
  alreadyConfigured: boolean;
}

export function importPathBetween(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  const base = toFile.replace(path.extname(toFile), '');
  let rel = path.relative(fromDir, base).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

export interface AppModuleTransformerOptions {
  appModulePath: string;
  configImportPath: string;
  projectRoot: string;
}

function hasTypeOrmModuleImport(sourceText: string): boolean {
  return /import\s*\{[^}]*TypeOrmModule[^}]*\}\s*from\s*['"]@nestjs\/typeorm['"]/.test(sourceText);
}

/**
 * Transform an app.module.ts to register TypeOrmModule.
 *
 * Idempotent: if `TypeOrmModule` is already imported *and* `TypeOrmModule.forRoot`
 * already appears in the `imports` array, nothing is changed.
 */
export async function transformAppModule(
  options: AppModuleTransformerOptions,
): Promise<TransformResult> {
  const { appModulePath, configImportPath, projectRoot } = options;

  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
  });

  const sourceText = fs.readFileSync(appModulePath, 'utf8');
  const sourceFile = project.createSourceFile(appModulePath, sourceText);

  const classDecl = sourceFile.getClasses().find((c) => c.getName() === 'AppModule');
  if (!classDecl) {
    throw new NestoraError(
      `Could not find "export class AppModule" in ${appModulePath}.`,
    );
  }

  const moduleDecorator = classDecl.getDecorator('Module');
  if (!moduleDecorator) {
    throw new NestoraError(
      `Could not find @Module() decorator on AppModule in ${appModulePath}.`,
    );
  }

  const objectLiteral = moduleDecorator
    .getCallExpression()
    ?.getArguments()[0] as ObjectLiteralExpression | undefined;

  if (!objectLiteral) {
    throw new NestoraError(
      `@Module() in ${appModulePath} has no object argument.`,
    );
  }

  const importsProp = objectLiteral.getProperty('imports');
  let importsArray =
    importsProp?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer()?.asKind(
      SyntaxKind.ArrayLiteralExpression,
    ) ?? undefined;


  const alreadyImported = hasTypeOrmModuleImport(sourceText);
  const alreadyRegistered =
    importsArray?.getElements().some((el) =>
      el.getText().startsWith('TypeOrmModule.forRoot'),
    ) ?? false;

  if (alreadyImported && alreadyRegistered) {
    return { changed: false, alreadyConfigured: true };
  }


  if (!importsProp) {
    objectLiteral.addPropertyAssignment({ name: 'imports', initializer: '[]' });
    const fresh = objectLiteral.getProperty('imports')?.asKind(SyntaxKind.PropertyAssignment);
    importsArray =
      fresh?.getInitializer()?.asKind(SyntaxKind.ArrayLiteralExpression) ??
      undefined;
  }

  if (!importsArray) {
    throw new NestoraError(
      `"imports" in ${appModulePath} is not an array literal and cannot be modified safely.`,
    );
  }

  if (!alreadyRegistered) {
    const elements = importsArray.getElements();
    const hasForRoot = elements.some(
      (el: Node) => el.getText().startsWith('TypeOrmModule.forRoot'),
    );
    if (!hasForRoot) {
      importsArray.addElement('TypeOrmModule.forRoot(databaseConfig)');
    }
  }

  if (!alreadyImported) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@nestjs/typeorm',
      namedImports: ['TypeOrmModule'],
    });
  }

  const hasConfigImport = sourceFile
    .getImportDeclarations()
    .some((imp) =>
      imp.getNamedImports().some((n) => n.getName() === 'databaseConfig'),
    );

  if (!hasConfigImport) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: configImportPath,
      namedImports: ['databaseConfig'],
    });
  }

  fs.writeFileSync(appModulePath, sourceFile.getFullText(), 'utf8');

  await applyPrettier(appModulePath, projectRoot);

  return { changed: true, alreadyConfigured: false };
}

async function applyPrettier(filePath: string, projectRoot: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf8');

  try {
    const config = await resolveConfig(projectRoot, { useCache: false });
    const options: Record<string, unknown> = config ?? {
      singleQuote: true,
      semi: true,
      trailingComma: 'all',
    };
    options.parser = 'typescript';
    const formatted = await format(content, options);
    fs.writeFileSync(filePath, formatted, 'utf8');
  } catch {
    logger.warn(`Prettier reformat of ${filePath} failed — keeping transformed output.`);
  }
}
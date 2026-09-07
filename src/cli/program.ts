import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { typeormCommand } from '../commands/typeorm.command.js';
import { migrationCommands } from '../commands/migration.command.js';

function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const program = new Command()
  .name('nestora')
  .description('Scaffold common NestJS integrations into your project.')
  .version(readVersion());

program.addCommand(typeormCommand);
for (const command of migrationCommands) {
  program.addCommand(command);
}
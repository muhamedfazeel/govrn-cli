import { Command } from 'commander';

export * from './types/index.js';
export * from './utils/fs.js';
export * from './utils/logger.js';

const program = new Command();

program
  .name('govrn-cli')
  .description('Enterprise-grade AI context governance engine and CLI')
  .version('0.1.0');

export function runCli(argv = process.argv): void {
  program.parse(argv);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  runCli();
}

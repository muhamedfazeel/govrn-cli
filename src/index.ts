import process from 'node:process';
import { Command } from 'commander';
import { runLint } from './commands/lint.js';
import { displayHelp } from './commands/help.js';
import type { TopologyMode } from './types/index.js';
import pc from 'picocolors';

const program = new Command();

program
  .name('govrn-cli')
  .description('Enterprise-grade AI context governance engine and CLI')
  .version('0.1.0');

// Help command
program
  .command('help')
  .description('Display detailed color-coded governance guide')
  .action(() => {
    displayHelp();
  });

// Lint command (explicit)
program
  .command('lint', { isDefault: true })
  .description('Validate AI context rules, DAG cycles, token budgets, and topologies')
  .option('-f, --format <format>', 'Output format: terminal | sarif', 'terminal')
  .option('-p, --path <dir>', 'Unified context directory path override (default: .ai/)')
  .option(
    '-t, --topology <mode>',
    'Declare agent topology: orchestrator | standalone | auto',
    'auto'
  )
  .action(async (options: { format?: string; path?: string; topology?: string }) => {
    try {
      const format = options.format === 'sarif' ? 'sarif' : 'terminal';
      const topology = options.topology as TopologyMode | undefined;

      const result = await runLint({
        format,
        path: options.path,
        topology,
      });

      if (result.errorCount > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(pc.red(`\n✖ Fatal error during governance lint: ${msg}\n`));
      process.exit(1);
    }
  });

// Override default help option
program.helpInformation = () => {
  displayHelp();
  return '';
};

// Execute CLI
program.parse(process.argv);

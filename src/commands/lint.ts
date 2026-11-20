import process from 'node:process';
import type { Diagnostic, TopologyMode, ValidationContext } from '../types/index.js';
import { loadConfig } from '../config/index.js';
import { discoverRules } from '../parser/discovery.js';
import { validateLinks } from '../validator/links.js';
import { validateDAG } from '../validator/dag.js';
import { validateTopology } from '../validator/topology.js';
import { validateBudget } from '../validator/budget.js';
import { validateGlobs } from '../validator/globs.js';
import { validateCollisions } from '../validator/collisions.js';
import { validateHeuristics } from '../validator/heuristics.js';
import { validateSecurity } from '../validator/security.js';
import { reportTerminal } from '../reporters/terminal.js';
import { reportSarif } from '../reporters/sarif.js';

export interface LintCommandOptions {
  format?: 'terminal' | 'sarif';
  path?: string;
  topology?: TopologyMode;
  cwd?: string;
}

export interface LintExecutionResult {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  filesScanned: number;
}

/**
 * Runs the static analysis and governance validation pipeline.
 */
export async function runLint(options: LintCommandOptions = {}): Promise<LintExecutionResult> {
  const workspaceRoot = options.cwd ?? process.cwd();
  const format = options.format ?? 'terminal';

  // 1. Load configuration with CLI overrides
  const config = await loadConfig(workspaceRoot, {
    agentsPath: options.path,
    topology: options.topology,
  });

  // 2. Discover and parse rule files & repo tree
  const discovery = await discoverRules(workspaceRoot, config);

  const context: ValidationContext = {
    workspaceRoot,
    config,
    rules: discovery.rules,
    repoFiles: discovery.repoFiles,
  };

  // 3. Run all 8 validator passes
  const allDiagnostics: Diagnostic[] = [
    ...discovery.diagnostics,
    ...validateLinks(context),
    ...validateDAG(context),
    ...validateTopology(context),
    ...validateBudget(context),
    ...validateGlobs(context),
    ...validateCollisions(context),
    ...validateHeuristics(context),
    ...validateSecurity(context),
  ];

  const errorCount = allDiagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = allDiagnostics.filter((d) => d.severity === 'warning').length;
  const infoCount = allDiagnostics.filter((d) => d.severity === 'info').length;

  const result: LintExecutionResult = {
    diagnostics: allDiagnostics,
    errorCount,
    warningCount,
    infoCount,
    filesScanned: discovery.rules.length,
  };

  // 4. Report results
  if (format === 'sarif') {
    reportSarif(allDiagnostics);
  } else {
    reportTerminal(allDiagnostics, {
      filesScanned: discovery.rules.length,
      errorCount,
      warningCount,
      infoCount,
    });
  }

  return result;
}

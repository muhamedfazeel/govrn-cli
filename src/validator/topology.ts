import path from 'node:path';
import type { Diagnostic, ParsedRule, ValidationContext } from '../types/index.js';
import { resolvePointerPath } from './links.js';
import { safeExists, toPosixPath } from '../utils/fs.js';

/**
 * Validates agent topology (Orchestrator vs. Standalone).
 */
export function validateTopology(context: ValidationContext): Diagnostic[] {
  const { workspaceRoot, config, rules } = context;
  const diagnostics: Diagnostic[] = [];

  const normalizedOrchestrator = toPosixPath(config.orchestratorFile);
  const orchestratorAbsPath = path.resolve(workspaceRoot, normalizedOrchestrator);
  const orchestratorExists = safeExists(orchestratorAbsPath);
  const normalizedAgentsPath = config.agentsPath.replace(/\/+$/, '');
  const agentsSubdir = `${normalizedAgentsPath}/agents/`;

  const isOrchestratorMode =
    config.topology === 'orchestrator' || (config.topology === 'auto' && orchestratorExists);

  if (isOrchestratorMode) {
    if (!orchestratorExists) {
      diagnostics.push({
        file: normalizedOrchestrator,
        ruleId: 'topology/missing-orchestrator',
        severity: 'error',
        message: `Designated orchestrator file '${normalizedOrchestrator}' does not exist on disk in orchestrator mode.`,
      });
      return diagnostics;
    }

    const orchestratorRule = rules.find((r) => r.path === normalizedOrchestrator);
    if (!orchestratorRule) {
      diagnostics.push({
        file: normalizedOrchestrator,
        ruleId: 'topology/unparsed-orchestrator',
        severity: 'error',
        message: `Orchestrator file '${normalizedOrchestrator}' was not parsed.`,
      });
      return diagnostics;
    }

    // Verify orchestrator references at least one subagent in agentsPath/agents/
    const subagentReferences: string[] = [];
    for (const pointer of orchestratorRule.pointers) {
      const { relativePath } = resolvePointerPath(
        workspaceRoot,
        orchestratorRule.path,
        pointer.target
      );
      if (relativePath.startsWith(agentsSubdir) && relativePath !== normalizedOrchestrator) {
        subagentReferences.push(relativePath);
      }
    }

    if (subagentReferences.length === 0) {
      diagnostics.push({
        file: orchestratorRule.path,
        ruleId: 'topology/no-subagents',
        severity: 'error',
        message: `Orchestrator '${orchestratorRule.path}' does not reference any subagents in '${agentsSubdir}'. An orchestrator must coordinate at least one subagent.`,
      });
    }

    // Verify subagent definitions and delegation links
    for (const subagentRelPath of subagentReferences) {
      const subagentAbs = path.resolve(workspaceRoot, subagentRelPath);
      if (!safeExists(subagentAbs)) {
        diagnostics.push({
          file: orchestratorRule.path,
          ruleId: 'topology/broken-subagent-link',
          severity: 'error',
          message: `Orchestrator delegates to subagent '${subagentRelPath}', but the subagent definition file does not exist on disk.`,
        });
      }
    }
  } else if (config.topology === 'standalone') {
    // In standalone mode, agents should be self-contained and not depend on an orchestrator
    for (const rule of rules) {
      const isAgentFile = rule.path.startsWith(agentsSubdir);
      if (!isAgentFile) continue;

      for (const pointer of rule.pointers) {
        const { relativePath } = resolvePointerPath(
          workspaceRoot,
          rule.path,
          pointer.target
        );

        if (relativePath === normalizedOrchestrator) {
          diagnostics.push({
            file: rule.path,
            ruleId: 'topology/standalone-orchestrator-ref',
            severity: 'warning',
            message: `Agent '${rule.path}' references orchestrator '${normalizedOrchestrator}', but project is configured with standalone agent topology. Standalone agents should be independent.`,
            line: pointer.line,
          });
        }
      }
    }
  }

  return diagnostics;
}

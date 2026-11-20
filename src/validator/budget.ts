import { get_encoding, type Tiktoken } from 'tiktoken';
import type { Diagnostic, ParsedRule, ValidationContext } from '../types/index.js';
import { resolvePointerPath } from './links.js';

/**
 * Recursively expands pointers for a given entry rule in memory to calculate the compiled context payload.
 */
export function expandCompiledPayload(
  workspaceRoot: string,
  entryRule: ParsedRule,
  ruleMap: Map<string, ParsedRule>
): { compiledText: string; expandedPaths: string[] } {
  const visited = new Set<string>([entryRule.path]);
  const queue: ParsedRule[] = [entryRule];
  const parts: string[] = [entryRule.body];
  const expandedPaths: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const pointer of current.pointers) {
      const { relativePath } = resolvePointerPath(
        workspaceRoot,
        current.path,
        pointer.target
      );

      if (!visited.has(relativePath)) {
        visited.add(relativePath);
        const targetRule = ruleMap.get(relativePath);
        if (targetRule) {
          expandedPaths.push(relativePath);
          parts.push(targetRule.body);
          queue.push(targetRule);
        }
      }
    }
  }

  return {
    compiledText: parts.join('\n\n'),
    expandedPaths,
  };
}

/**
 * Validates token budgets for each tool entry rule, expanding references to detect cascade context bloat.
 */
export function validateBudget(context: ValidationContext): Diagnostic[] {
  const { workspaceRoot, config, rules } = context;
  const diagnostics: Diagnostic[] = [];

  // Index rules by relative path
  const ruleMap = new Map<string, ParsedRule>();
  for (const r of rules) {
    ruleMap.set(r.path, r);
  }

  let encoder: Tiktoken | null = null;
  try {
    encoder = get_encoding('cl100k_base');
  } catch {
    // If tiktoken wasm initialization fails, fallback gracefully
    encoder = null;
  }

  try {
    for (const rule of rules) {
      // We evaluate budget for entry-point rules (native tools, legacy files, or orchestrator)
      const isEntryPoint =
        rule.adapter !== 'ssot' || rule.path === config.orchestratorFile.replace(/\\/g, '/');

      if (!isEntryPoint) continue;

      const { compiledText, expandedPaths } = expandCompiledPayload(
        workspaceRoot,
        rule,
        ruleMap
      );

      let rawTokens: number;
      let compiledTokens: number;

      if (encoder) {
        rawTokens = encoder.encode(rule.content).length;
        compiledTokens = encoder.encode(compiledText).length;
      } else {
        // Fallback approximation: 1 token ≈ 4 characters
        rawTokens = Math.ceil(rule.content.length / 4);
        compiledTokens = Math.ceil(compiledText.length / 4);
      }

      if (compiledTokens > config.maxTokens) {
        const fileCountMsg =
          expandedPaths.length > 0
            ? ` across ${expandedPaths.length} referenced files (${expandedPaths.slice(0, 3).join(', ')}${
                expandedPaths.length > 3 ? '...' : ''
              })`
            : '';

        diagnostics.push({
          file: rule.path,
          ruleId: 'budget/max-tokens-exceeded',
          severity: 'warning',
          message: `Compiled context payload exceeds token budget (${compiledTokens} tokens > limit of ${config.maxTokens} tokens). Entry file: ${rawTokens} tokens, compiled payload: ${compiledTokens} tokens${fileCountMsg}.`,
        });
      }
    }
  } finally {
    if (encoder) {
      encoder.free();
    }
  }

  return diagnostics;
}

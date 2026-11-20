import micromatch from 'micromatch';
import type { Diagnostic, ValidationContext } from '../types/index.js';

/**
 * Validates frontmatter glob patterns against actual files in the repository.
 */
export function validateGlobs(context: ValidationContext): Diagnostic[] {
  const { config, rules, repoFiles } = context;
  const diagnostics: Diagnostic[] = [];

  for (const rule of rules) {
    if (!rule.globs || rule.globs.length === 0) continue;

    for (const pattern of rule.globs) {
      // 1. Syntax check
      try {
        micromatch.makeRe(pattern);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        diagnostics.push({
          file: rule.path,
          ruleId: 'globs/invalid-syntax',
          severity: 'error',
          message: `Glob pattern '${pattern}' has invalid syntax: ${msg}`,
        });
        continue;
      }

      // 2. Repository matching check (if strictGlobs enabled)
      if (config.strictGlobs) {
        let matches: string[] = [];
        try {
          matches = micromatch(repoFiles, [pattern], { dot: true });
        } catch {
          matches = [];
        }

        if (matches.length === 0) {
          diagnostics.push({
            file: rule.path,
            ruleId: 'globs/unmatched-pattern',
            severity: 'warning',
            message: `Glob pattern '${pattern}' matched 0 files in the repository. This rule will never be triggered.`,
          });
        }
      }
    }
  }

  return diagnostics;
}

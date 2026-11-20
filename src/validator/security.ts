import path from 'node:path';
import micromatch from 'micromatch';
import type { Diagnostic, ValidationContext } from '../types/index.js';
import { safeExists, safeReadFile } from '../utils/fs.js';

/**
 * Validates security guardrails and .govrnignore coverage for sensitive credentials.
 */
export function validateSecurity(context: ValidationContext): Diagnostic[] {
  const { workspaceRoot, config, rules } = context;
  const diagnostics: Diagnostic[] = [];

  const govrnIgnorePath = path.resolve(workspaceRoot, '.govrnignore');
  const legacyAiIgnorePath = path.resolve(workspaceRoot, '.aiignore');

  const govrnIgnoreExists = safeExists(govrnIgnorePath);
  const legacyExists = !govrnIgnoreExists && safeExists(legacyAiIgnorePath);

  if (!govrnIgnoreExists && !legacyExists) {
    diagnostics.push({
      file: '.govrnignore',
      ruleId: 'security/missing-govrnignore',
      severity: 'error',
      message: `No '.govrnignore' file found at workspace root. AI agents may inadvertently index secrets, credentials, or sensitive configuration files.`,
    });
  } else {
    const activePath = govrnIgnoreExists ? govrnIgnorePath : legacyAiIgnorePath;
    const activeFileName = path.basename(activePath);

    if (legacyExists) {
      diagnostics.push({
        file: '.aiignore',
        ruleId: 'security/legacy-aiignore',
        severity: 'warning',
        message: `Found legacy '.aiignore' file. Rename '.aiignore' to '.govrnignore' to standardize governance security guardrails.`,
      });
    }

    const rawContent = safeReadFile(activePath);
    const ignorePatterns = rawContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    // Check if each sensitive path pattern from config is covered in .govrnignore
    for (const sensitivePattern of config.sensitivePaths) {
      const directMatch = ignorePatterns.includes(sensitivePattern);

      const samplePaths = [
        sensitivePattern.replace(/\*\*/g, 'foo/bar').replace(/\*/g, 'secret'),
        sensitivePattern.replace(/\*/g, 'key'),
        sensitivePattern.replace(/\/\*\*$/, '/file.txt'),
      ];

      const isCovered =
        directMatch ||
        samplePaths.some((sample) => micromatch.isMatch(sample, ignorePatterns, { dot: true }));

      if (!isCovered) {
        diagnostics.push({
          file: activeFileName,
          ruleId: 'security/unprotected-sensitive-path',
          severity: 'error',
          message: `Sensitive path '${sensitivePattern}' is not covered by patterns in '${activeFileName}'. Add it to '${activeFileName}' to protect sensitive credentials from AI context indexing.`,
        });
      }
    }
  }

  // Check if any rule explicitly targets sensitive files via globs
  for (const rule of rules) {
    if (!rule.globs) continue;

    for (const glob of rule.globs) {
      for (const sensitivePattern of config.sensitivePaths) {
        if (glob === sensitivePattern || glob.includes('.env') || glob.includes('secret')) {
          diagnostics.push({
            file: rule.path,
            ruleId: 'security/rule-exposes-sensitive-path',
            severity: 'error',
            message: `Rule defines glob '${glob}' which targets sensitive credentials matching '${sensitivePattern}'. Exclude sensitive paths from rule definitions.`,
          });
        }
      }
    }
  }

  return diagnostics;
}

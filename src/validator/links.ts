import path from 'node:path';
import type { Diagnostic, ValidationContext } from '../types/index.js';
import { inspectSymlink, safeExists, toPosixPath } from '../utils/fs.js';

/**
 * Resolves a pointer target relative to the linking file or the workspace root.
 */
export function resolvePointerPath(
  workspaceRoot: string,
  sourceFilePath: string,
  target: string
): { relativePath: string; absolutePath: string } {
  let absPath: string;

  if (target.startsWith('./') || target.startsWith('../')) {
    const sourceDir = path.dirname(path.resolve(workspaceRoot, sourceFilePath));
    absPath = path.resolve(sourceDir, target);
  } else {
    // Treat as workspace-relative path
    absPath = path.resolve(workspaceRoot, target);
  }

  const relativePath = toPosixPath(path.relative(workspaceRoot, absPath));
  return { relativePath, absolutePath: absPath };
}

/**
 * Validates file pointers, symlinks portability, and detects unreferenced SSOT orphans.
 */
export function validateLinks(context: ValidationContext): Diagnostic[] {
  const { workspaceRoot, config, rules } = context;
  const diagnostics: Diagnostic[] = [];

  const referencedPaths = new Set<string>();
  const normalizedAgentsPath = config.agentsPath.replace(/\/+$/, '');

  // 1. Validate pointers in each rule
  for (const rule of rules) {
    // Check symlink characteristics of the rule file itself
    const symlinkInfo = inspectSymlink(rule.absolutePath);
    if (symlinkInfo.isSymlink) {
      if (symlinkInfo.isBroken) {
        diagnostics.push({
          file: rule.path,
          ruleId: 'links/broken-symlink',
          severity: 'error',
          message: `Symlink target '${symlinkInfo.target}' does not exist on disk.`,
        });
      } else {
        if (symlinkInfo.resolvedPath) {
          const relTarget = toPosixPath(path.relative(workspaceRoot, symlinkInfo.resolvedPath));
          referencedPaths.add(relTarget);
        }

        if (symlinkInfo.isAbsolute) {
          diagnostics.push({
            file: rule.path,
            ruleId: 'links/non-portable-symlink',
            severity: 'warning',
            message: `Symlink uses an absolute path ('${symlinkInfo.target}'). This will break in CI/CD and across different developer environments. Use relative paths or SSOT markdown pointers instead.`,
          });
        } else if (symlinkInfo.isRelativeNonPortable) {
          diagnostics.push({
            file: rule.path,
            ruleId: 'links/windows-symlink-hazard',
            severity: 'warning',
            message: `Symlink '${rule.path}' -> '${symlinkInfo.target}' may fail on Windows without Developer Mode enabled. Consider using markdown pointers or compiling rules.`,
          });
        }
      }
    }

    // Check all extracted AST pointers
    for (const pointer of rule.pointers) {
      const { relativePath, absolutePath } = resolvePointerPath(
        workspaceRoot,
        rule.path,
        pointer.target
      );

      referencedPaths.add(relativePath);

      // Check existence on disk (could be a file or a directory pointer like .ai/rules/)
      if (!safeExists(absolutePath)) {
        diagnostics.push({
          file: rule.path,
          ruleId: 'links/broken-pointer',
          severity: 'error',
          message: `Referenced path '${pointer.target}' does not resolve to an existing file or directory on disk.`,
          line: pointer.line,
          column: pointer.column,
        });
      }
    }
  }

  // 2. Orphan detection: check for unreferenced rules, skills, and agents under agentsPath
  const normalizedOrchestrator = toPosixPath(config.orchestratorFile);

  for (const rule of rules) {
    const isUnderAgentsPath = rule.path.startsWith(normalizedAgentsPath + '/');
    if (!isUnderAgentsPath) continue;

    // Skip orchestrator itself and README/index files
    if (rule.path === normalizedOrchestrator) continue;
    const baseName = path.basename(rule.path).toLowerCase();
    if (baseName === 'readme.md' || baseName === 'index.md') continue;

    // Check if this rule is referenced by any entry point or sibling rule
    const isReferenced = referencedPaths.has(rule.path);
    if (!isReferenced) {
      let kind = 'rule';
      let ruleId = 'orphan/unreferenced-rule';

      if (rule.path.includes('/skills/')) {
        kind = 'skill';
        ruleId = 'orphan/unreferenced-skill';
      } else if (rule.path.includes('/agents/')) {
        kind = 'agent';
        ruleId = 'orphan/unreferenced-agent';
      }

      diagnostics.push({
        file: rule.path,
        ruleId,
        severity: 'warning',
        message: `Orphan ${kind} detected: '${rule.path}' is never referenced by any active AI tool entry point, orchestrator, or sibling rule.`,
      });
    }
  }

  return diagnostics;
}

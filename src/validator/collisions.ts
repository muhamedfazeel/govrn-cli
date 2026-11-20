import type { Diagnostic, ValidationContext } from '../types/index.js';
import { resolvePointerPath } from './links.js';

/**
 * Detects conflicting legacy files and unsynced rule duplicates across AI tool entry points.
 */
export function validateCollisions(context: ValidationContext): Diagnostic[] {
  const { workspaceRoot, rules } = context;
  const diagnostics: Diagnostic[] = [];

  const rulePathSet = new Set(rules.map((r) => r.path));

  // 1. Legacy .cursorrules collision with modern .cursor/rules/ or AGENTS.md
  const hasLegacyCursor = rulePathSet.has('.cursorrules');
  const hasModernCursor = rules.some(
    (r) => r.path.startsWith('.cursor/rules/') && r.path.endsWith('.mdc')
  );
  const hasAgentsMd = rulePathSet.has('AGENTS.md');

  if (hasLegacyCursor && (hasModernCursor || hasAgentsMd)) {
    const presentModern = hasModernCursor ? "'.cursor/rules/'" : "'AGENTS.md'";
    diagnostics.push({
      file: '.cursorrules',
      ruleId: 'collisions/legacy-cursorrules',
      severity: 'warning',
      message: `Legacy '.cursorrules' detected while modern ${presentModern} is also present. Migrate rules to modern .mdc format or centralized SSOT to prevent conflicting instructions.`,
    });
  }

  // 2. Unsynced CLAUDE.md and AGENTS.md
  const claudeRule = rules.find((r) => r.path === 'CLAUDE.md');
  if (claudeRule && hasAgentsMd) {
    // Check if CLAUDE.md is a symlink to AGENTS.md or references AGENTS.md
    let referencesAgents = false;

    if (claudeRule.isSymlink && claudeRule.symlinkTarget) {
      const { relativePath } = resolvePointerPath(
        workspaceRoot,
        claudeRule.path,
        claudeRule.symlinkTarget
      );
      if (relativePath === 'AGENTS.md') {
        referencesAgents = true;
      }
    }

    if (!referencesAgents) {
      for (const pointer of claudeRule.pointers) {
        const { relativePath } = resolvePointerPath(
          workspaceRoot,
          claudeRule.path,
          pointer.target
        );
        if (relativePath === 'AGENTS.md') {
          referencesAgents = true;
          break;
        }
      }
    }

    if (!referencesAgents) {
      diagnostics.push({
        file: 'CLAUDE.md',
        ruleId: 'collisions/unsynced-claude-agents',
        severity: 'warning',
        message: `Both 'CLAUDE.md' and 'AGENTS.md' exist, but 'CLAUDE.md' does not reference or import 'AGENTS.md' (e.g. '@AGENTS.md'). Rules risk diverging across AI tools.`,
      });
    }
  }

  return diagnostics;
}

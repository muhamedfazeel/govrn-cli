import type { GovrnConfig, ToolAdapter } from '../types/index.js';

export const BUILTIN_ADAPTERS: ToolAdapter[] = [
  {
    name: 'cursor',
    description: 'Cursor IDE rules (.cursor/rules/*.mdc) and legacy .cursorrules',
    globs: ['.cursor/rules/**/*.mdc'],
    legacyGlobs: ['.cursorrules'],
    type: 'native',
  },
  {
    name: 'claude',
    description: 'Claude Code instructions (CLAUDE.md, .claude/**/*)',
    globs: ['CLAUDE.md', '.claude/**/*'],
    type: 'native',
  },
  {
    name: 'copilot',
    description: 'GitHub Copilot instructions (.github/copilot-instructions.md)',
    globs: ['.github/copilot-instructions.md'],
    type: 'native',
  },
  {
    name: 'gemini',
    description: 'Gemini context files (GEMINI.md, .gemini/**/*)',
    globs: ['GEMINI.md', '.gemini/**/*'],
    type: 'native',
  },
  {
    name: 'codex',
    description: 'Codex and general agent guidelines (AGENTS.md, CODEX.md)',
    globs: ['AGENTS.md', 'CODEX.md'],
    type: 'native',
  },
  {
    name: 'kiro',
    description: 'Kiro steering rules (.kiro/steering/**/*)',
    globs: ['.kiro/steering/**/*'],
    type: 'native',
  },
  {
    name: 'windsurf',
    description: 'Windsurf rules (.windsurfrules, .windsurf/rules/**/*)',
    globs: ['.windsurfrules', '.windsurf/rules/**/*'],
    type: 'native',
  },
];

/**
 * Resolves active adapters based on configuration filters and custom tool registrations.
 */
export function resolveAdapters(config: GovrnConfig): ToolAdapter[] {
  let adapters = [...BUILTIN_ADAPTERS];

  if (config.tools && config.tools.length > 0) {
    const filterSet = new Set(config.tools.map((t) => t.toLowerCase()));
    adapters = adapters.filter((a) => filterSet.has(a.name.toLowerCase()));
  }

  if (config.customTools && config.customTools.length > 0) {
    for (const custom of config.customTools) {
      adapters.push({
        name: custom.name,
        description: `Custom user-defined tool: ${custom.name}`,
        globs: custom.globs,
        type: 'custom',
      });
    }
  }

  // Always include SSOT adapter for the designated agentsPath
  const ssotPattern = `${config.agentsPath.replace(/\/+$/, '')}/**/*`;
  adapters.push({
    name: 'ssot',
    description: `Centralized Single Source of Truth (${config.agentsPath})`,
    globs: [ssotPattern],
    type: 'ssot',
  });

  return adapters;
}

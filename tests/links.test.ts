import { describe, it, expect, vi } from 'vitest';
import { resolvePointerPath, validateLinks } from '../src/validator/links.js';
import type { ParsedRule, ValidationContext } from '../src/types/index.js';
import * as fsUtils from '../src/utils/fs.js';

describe('Links, Symlinks & Orphan Validator', () => {
  it('correctly resolves relative and workspace-relative pointer paths', () => {
    const r1 = resolvePointerPath('/workspace', '.cursor/rules/api.mdc', '../../.ai/rules/db.md');
    expect(r1.relativePath).toBe('.ai/rules/db.md');

    const r2 = resolvePointerPath('/workspace', 'CLAUDE.md', '.ai/rules/frontend.md');
    expect(r2.relativePath).toBe('.ai/rules/frontend.md');
  });

  it('emits error diagnostic for broken pointer on disk', () => {
    vi.spyOn(fsUtils, 'safeExists').mockReturnValue(false);
    vi.spyOn(fsUtils, 'inspectSymlink').mockReturnValue({ isSymlink: false });

    const rule: ParsedRule = {
      path: '.cursor/rules/router.mdc',
      absolutePath: '/workspace/.cursor/rules/router.mdc',
      adapter: 'cursor',
      content: '',
      body: '',
      frontmatter: {},
      pointers: [{ target: '.ai/rules/missing.md', raw: '[Missing](.ai/rules/missing.md)', line: 12 }],
      globs: [],
      isLegacy: false,
      isSymlink: false,
    };

    const context: ValidationContext = {
      workspaceRoot: '/workspace',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [rule],
      repoFiles: [],
    };

    const diags = validateLinks(context);
    expect(diags.some((d) => d.ruleId === 'links/broken-pointer')).toBe(true);
    expect(diags[0]?.severity).toBe('error');
    expect(diags[0]?.line).toBe(12);
  });

  it('detects unreferenced orphan rules, skills, and agents under agentsPath', () => {
    vi.spyOn(fsUtils, 'safeExists').mockReturnValue(true);
    vi.spyOn(fsUtils, 'inspectSymlink').mockReturnValue({ isSymlink: false });

    const orphanRule: ParsedRule = {
      path: '.ai/rules/unused-rule.md',
      absolutePath: '/workspace/.ai/rules/unused-rule.md',
      adapter: 'ssot',
      content: '',
      body: '',
      frontmatter: {},
      pointers: [],
      globs: [],
      isLegacy: false,
      isSymlink: false,
    };

    const orphanSkill: ParsedRule = {
      path: '.ai/skills/unused-skill.md',
      absolutePath: '/workspace/.ai/skills/unused-skill.md',
      adapter: 'ssot',
      content: '',
      body: '',
      frontmatter: {},
      pointers: [],
      globs: [],
      isLegacy: false,
      isSymlink: false,
    };

    const context: ValidationContext = {
      workspaceRoot: '/workspace',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [orphanRule, orphanSkill],
      repoFiles: [],
    };

    const diags = validateLinks(context);
    expect(diags.some((d) => d.ruleId === 'orphan/unreferenced-rule')).toBe(true);
    expect(diags.some((d) => d.ruleId === 'orphan/unreferenced-skill')).toBe(true);
  });
});

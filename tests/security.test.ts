import { describe, it, expect, vi } from 'vitest';
import { validateSecurity } from '../src/validator/security.js';
import { validateCollisions } from '../src/validator/collisions.js';
import type { ParsedRule, ValidationContext } from '../src/types/index.js';
import * as fsUtils from '../src/utils/fs.js';

describe('Security & .govrnignore Validator', () => {
  it('flags error if .govrnignore is missing at workspace root', () => {
    vi.spyOn(fsUtils, 'safeExists').mockReturnValue(false);

    const context: ValidationContext = {
      workspaceRoot: '/mock',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: ['config/secrets/**', '.env*'],
      },
      rules: [],
      repoFiles: [],
    };

    const diags = validateSecurity(context);
    expect(diags.some((d) => d.ruleId === 'security/missing-govrnignore')).toBe(true);
    expect(diags[0]?.severity).toBe('error');
  });

  it('flags error if .govrnignore fails to exclude sensitivePaths', () => {
    vi.spyOn(fsUtils, 'safeExists').mockImplementation((p: string) => p.endsWith('.govrnignore'));
    vi.spyOn(fsUtils, 'safeReadFile').mockReturnValue('node_modules/\ndist/\n');

    const context: ValidationContext = {
      workspaceRoot: '/mock',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: ['config/secrets/**', '.env*'],
      },
      rules: [],
      repoFiles: [],
    };

    const diags = validateSecurity(context);
    expect(diags.filter((d) => d.ruleId === 'security/unprotected-sensitive-path')).toHaveLength(2);
  });

  it('passes when .govrnignore covers all sensitive paths', () => {
    vi.spyOn(fsUtils, 'safeExists').mockImplementation((p: string) => p.endsWith('.govrnignore'));
    vi.spyOn(fsUtils, 'safeReadFile').mockReturnValue('.env*\nconfig/secrets/**\nnode_modules/\n');

    const context: ValidationContext = {
      workspaceRoot: '/mock',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: ['config/secrets/**', '.env*'],
      },
      rules: [],
      repoFiles: [],
    };

    const diags = validateSecurity(context);
    expect(diags).toHaveLength(0);
  });
});

describe('Collisions Detector', () => {
  it('flags legacy .cursorrules when modern .cursor/rules/ is present', () => {
    const legacyRule: ParsedRule = {
      path: '.cursorrules',
      absolutePath: '/mock/.cursorrules',
      adapter: 'cursor',
      content: '',
      body: '',
      frontmatter: {},
      pointers: [],
      globs: [],
      isLegacy: true,
      isSymlink: false,
    };

    const modernRule: ParsedRule = {
      path: '.cursor/rules/ts.mdc',
      absolutePath: '/mock/.cursor/rules/ts.mdc',
      adapter: 'cursor',
      content: '',
      body: '',
      frontmatter: {},
      pointers: [],
      globs: [],
      isLegacy: false,
      isSymlink: false,
    };

    const context: ValidationContext = {
      workspaceRoot: '/mock',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [legacyRule, modernRule],
      repoFiles: [],
    };

    const diags = validateCollisions(context);
    expect(diags.some((d) => d.ruleId === 'collisions/legacy-cursorrules')).toBe(true);
    expect(diags[0]?.severity).toBe('warning');
  });

  it('warns when both CLAUDE.md and AGENTS.md exist without linkage', () => {
    const claudeRule: ParsedRule = {
      path: 'CLAUDE.md',
      absolutePath: '/mock/CLAUDE.md',
      adapter: 'claude',
      content: '# Claude instructions',
      body: '# Claude instructions',
      frontmatter: {},
      pointers: [],
      globs: [],
      isLegacy: false,
      isSymlink: false,
    };

    const agentsRule: ParsedRule = {
      path: 'AGENTS.md',
      absolutePath: '/mock/AGENTS.md',
      adapter: 'codex',
      content: '# Agents instructions',
      body: '# Agents instructions',
      frontmatter: {},
      pointers: [],
      globs: [],
      isLegacy: false,
      isSymlink: false,
    };

    const context: ValidationContext = {
      workspaceRoot: '/mock',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [claudeRule, agentsRule],
      repoFiles: [],
    };

    const diags = validateCollisions(context);
    expect(diags.some((d) => d.ruleId === 'collisions/unsynced-claude-agents')).toBe(true);
  });
});

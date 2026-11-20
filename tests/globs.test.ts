import { describe, it, expect } from 'vitest';
import { validateGlobs } from '../src/validator/globs.js';
import type { ParsedRule, ValidationContext } from '../src/types/index.js';

function createRuleWithGlobs(path: string, globs: string[]): ParsedRule {
  return {
    path,
    absolutePath: `/mock/${path}`,
    adapter: 'cursor',
    content: '',
    body: '',
    frontmatter: { globs },
    pointers: [],
    globs,
    isLegacy: false,
    isSymlink: false,
  };
}

describe('Glob Validator', () => {
  const repoFiles = ['src/index.ts', 'src/components/Button.tsx', 'src/utils/fs.ts', 'package.json'];

  it('passes when globs match existing repository files', () => {
    const rule = createRuleWithGlobs('.cursor/rules/ts.mdc', ['src/**/*.ts', 'src/**/*.tsx']);
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
      rules: [rule],
      repoFiles,
    };

    const diags = validateGlobs(context);
    expect(diags).toHaveLength(0);
  });

  it('warns when globs match 0 files and strictGlobs is true', () => {
    const rule = createRuleWithGlobs('.cursor/rules/python.mdc', ['**/*.py', '**/*.sql']);
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
      rules: [rule],
      repoFiles,
    };

    const diags = validateGlobs(context);
    expect(diags).toHaveLength(2);
    expect(diags[0]?.ruleId).toBe('globs/unmatched-pattern');
    expect(diags[0]?.severity).toBe('warning');
    expect(diags[0]?.message).toContain('matched 0 files');
  });

  it('suppresses unmatched warnings when strictGlobs is false', () => {
    const rule = createRuleWithGlobs('.cursor/rules/python.mdc', ['**/*.py']);
    const context: ValidationContext = {
      workspaceRoot: '/mock',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: false,
        sensitivePaths: [],
      },
      rules: [rule],
      repoFiles,
    };

    const diags = validateGlobs(context);
    expect(diags).toHaveLength(0);
  });
});

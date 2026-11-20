import { describe, it, expect } from 'vitest';
import { validateHeuristics } from '../src/validator/heuristics.js';
import type { ParsedRule, ValidationContext } from '../src/types/index.js';

function createRule(path: string, body: string, globs: string[] = []): ParsedRule {
  return {
    path,
    absolutePath: `/mock/${path}`,
    adapter: 'mock',
    content: body,
    body,
    frontmatter: {},
    pointers: [],
    globs,
    isLegacy: false,
    isSymlink: false,
  };
}

describe('Heuristic Conflict, Scope Mismatch & Vagueness Validator', () => {
  it('detects contradictory directive pairs across rules (fetch vs axios)', () => {
    const rule1 = createRule('ruleA.md', 'Always use fetch for all HTTP network requests.');
    const rule2 = createRule('ruleB.md', 'Prefer axios when making API calls.');

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
      rules: [rule1, rule2],
      repoFiles: [],
    };

    const diags = validateHeuristics(context);
    expect(diags.some((d) => d.ruleId === 'heuristics/contradictory-directives')).toBe(true);
    expect(diags[0]?.severity).toBe('warning');
    expect(diags[0]?.message).toContain('HTTP Client');
  });

  it('detects tabs vs spaces indentation contradictions', () => {
    const rule1 = createRule('ruleA.md', 'Always use tabs for indentation.');
    const rule2 = createRule('ruleB.md', 'Enforce spaces with 2-space indentation.');

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
      rules: [rule1, rule2],
      repoFiles: [],
    };

    const diags = validateHeuristics(context);
    expect(diags.some((d) => d.ruleId === 'heuristics/contradictory-directives')).toBe(true);
  });

  it('detects scope mismatch between SQL globs and React frontend directives', () => {
    const rule = createRule(
      'db-rules.mdc',
      'Make sure to create React components with useState and JSX and use Tailwind classes for styling.',
      ['**/*.sql', '**/*.prisma']
    );

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
      repoFiles: [],
    };

    const diags = validateHeuristics(context);
    expect(diags.some((d) => d.ruleId === 'heuristics/scope-mismatch')).toBe(true);
    expect(diags[0]?.severity).toBe('warning');
  });

  it('flags vague un-actionable phrasing as info diagnostics', () => {
    const rule = createRule('general.md', 'Please write clean code and follow best practices in all modules.');

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
      repoFiles: [],
    };

    const diags = validateHeuristics(context);
    expect(diags.filter((d) => d.ruleId === 'heuristics/vague-rule')).toHaveLength(2);
    expect(diags[0]?.severity).toBe('info');
    expect(diags[0]?.message).toContain('Vague directive');
  });
});

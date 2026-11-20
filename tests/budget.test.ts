import { describe, it, expect } from 'vitest';
import { expandCompiledPayload, validateBudget } from '../src/validator/budget.js';
import type { ParsedRule, ValidationContext } from '../src/types/index.js';

function createRule(path: string, body: string, pointers: string[] = []): ParsedRule {
  return {
    path,
    absolutePath: `/mock-root/${path}`,
    adapter: path.startsWith('.cursor') ? 'cursor' : 'ssot',
    content: body,
    body,
    frontmatter: {},
    pointers: pointers.map((t) => ({ target: t, raw: t })),
    globs: [],
    isLegacy: false,
    isSymlink: false,
  };
}

describe('Compiled Token Budget Validator', () => {
  it('recursively expands referenced pointer contents in memory', () => {
    const entry = createRule('.cursor/rules/main.mdc', 'Entry instruction', ['.ai/rules/part1.md']);
    const part1 = createRule('.ai/rules/part1.md', 'Part 1 content', ['.ai/rules/part2.md']);
    const part2 = createRule('.ai/rules/part2.md', 'Part 2 content', []);

    const ruleMap = new Map<string, ParsedRule>([
      [entry.path, entry],
      [part1.path, part1],
      [part2.path, part2],
    ]);

    const { compiledText, expandedPaths } = expandCompiledPayload('/mock-root', entry, ruleMap);

    expect(compiledText).toContain('Entry instruction');
    expect(compiledText).toContain('Part 1 content');
    expect(compiledText).toContain('Part 2 content');
    expect(expandedPaths).toEqual(['.ai/rules/part1.md', '.ai/rules/part2.md']);
  });

  it('safely handles circular references during pointer expansion without infinite loop', () => {
    const entry = createRule('.cursor/rules/a.mdc', 'A content', ['.ai/rules/b.md']);
    const b = createRule('.ai/rules/b.md', 'B content', ['.cursor/rules/a.mdc']);

    const ruleMap = new Map<string, ParsedRule>([
      [entry.path, entry],
      [b.path, b],
    ]);

    const { compiledText, expandedPaths } = expandCompiledPayload('/mock-root', entry, ruleMap);

    expect(compiledText).toContain('A content');
    expect(compiledText).toContain('B content');
    expect(expandedPaths).toHaveLength(1);
  });

  it('warns when compiled payload exceeds configured maxTokens', () => {
    // Generate a long payload > 100 tokens
    const longText = 'word '.repeat(300);
    const entry = createRule('.cursor/rules/bloated.mdc', 'Short entry', ['.ai/rules/long.md']);
    const longRule = createRule('.ai/rules/long.md', longText, []);

    const context: ValidationContext = {
      workspaceRoot: '/mock-root',
      config: {
        agentsPath: '.ai/',
        topology: 'auto',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 50, // Low threshold to trigger warning
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [entry, longRule],
      repoFiles: [],
    };

    const diags = validateBudget(context);
    expect(diags.length).toBeGreaterThanOrEqual(1);
    expect(diags[0]?.ruleId).toBe('budget/max-tokens-exceeded');
    expect(diags[0]?.severity).toBe('warning');
    expect(diags[0]?.message).toContain('Compiled context payload exceeds token budget');
  });
});

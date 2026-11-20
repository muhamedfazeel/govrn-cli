import { describe, it, expect } from 'vitest';
import { buildRuleGraph, detectCycles, validateDAG } from '../src/validator/dag.js';
import type { ParsedRule, ValidationContext } from '../src/types/index.js';
import { DEFAULT_CONFIG } from '../src/config/index.js';

function createMockRule(path: string, pointerTargets: string[]): ParsedRule {
  return {
    path,
    absolutePath: `/workspace/${path}`,
    adapter: 'mock',
    content: '',
    body: '',
    frontmatter: {},
    pointers: pointerTargets.map((t) => ({ target: t, raw: t })),
    globs: [],
    isLegacy: false,
    isSymlink: false,
  };
}

describe('DAG Circular Dependency Guard', () => {
  it('detects no cycles in a linear DAG (A -> B -> C)', () => {
    const rules: ParsedRule[] = [
      createMockRule('a.md', ['b.md']),
      createMockRule('b.md', ['c.md']),
      createMockRule('c.md', []),
    ];

    const graph = buildRuleGraph('/workspace', rules);
    const cycles = detectCycles(graph);

    expect(cycles).toHaveLength(0);
  });

  it('detects a direct 2-node cycle (A -> B -> A)', () => {
    const rules: ParsedRule[] = [
      createMockRule('a.md', ['b.md']),
      createMockRule('b.md', ['a.md']),
    ];

    const graph = buildRuleGraph('/workspace', rules);
    const cycles = detectCycles(graph);

    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const cycleStr = cycles[0]?.path.join(' -> ');
    expect(cycleStr).toMatch(/a\.md -> b\.md -> a\.md|b\.md -> a\.md -> b\.md/);
  });

  it('detects a 3-node cycle (A -> B -> C -> A)', () => {
    const rules: ParsedRule[] = [
      createMockRule('a.md', ['b.md']),
      createMockRule('b.md', ['c.md']),
      createMockRule('c.md', ['a.md']),
    ];

    const graph = buildRuleGraph('/workspace', rules);
    const cycles = detectCycles(graph);

    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const cycleStr = cycles[0]?.path.join(' -> ');
    expect(cycleStr).toContain('a.md');
    expect(cycleStr).toContain('b.md');
    expect(cycleStr).toContain('c.md');
  });

  it('detects self-referencing cycle (A -> A)', () => {
    const rules: ParsedRule[] = [createMockRule('a.md', ['a.md'])];

    const graph = buildRuleGraph('/workspace', rules);
    const cycles = detectCycles(graph);

    expect(cycles.length).toBe(1);
    expect(cycles[0]?.path).toEqual(['a.md', 'a.md']);
  });

  it('emits error diagnostic through validateDAG', () => {
    const rules: ParsedRule[] = [
      createMockRule('rule1.md', ['rule2.md']),
      createMockRule('rule2.md', ['rule1.md']),
    ];

    const context: ValidationContext = {
      workspaceRoot: '/workspace',
      config: DEFAULT_CONFIG,
      rules,
      repoFiles: [],
    };

    const diagnostics = validateDAG(context);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.ruleId).toBe('dag/circular-dependency');
    expect(diagnostics[0]?.severity).toBe('error');
    expect(diagnostics[0]?.message).toContain('Circular dependency detected');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { validateTopology } from '../src/validator/topology.js';
import type { ParsedRule, ValidationContext } from '../src/types/index.js';
import * as fsUtils from '../src/utils/fs.js';

function createMockRule(path: string, pointers: string[] = []): ParsedRule {
  return {
    path,
    absolutePath: `/mock-root/${path}`,
    adapter: 'mock',
    content: '',
    body: '',
    frontmatter: {},
    pointers: pointers.map((t) => ({ target: t, raw: t })),
    globs: [],
    isLegacy: false,
    isSymlink: false,
  };
}

describe('Topology Validator', () => {
  it('flags error if orchestrator file does not exist in orchestrator mode', () => {
    vi.spyOn(fsUtils, 'safeExists').mockReturnValue(false);

    const context: ValidationContext = {
      workspaceRoot: '/mock-root',
      config: {
        agentsPath: '.ai/',
        topology: 'orchestrator',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [],
      repoFiles: [],
    };

    const diags = validateTopology(context);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.ruleId).toBe('topology/missing-orchestrator');
    expect(diags[0]?.severity).toBe('error');
  });

  it('flags error if orchestrator references 0 subagents', () => {
    vi.spyOn(fsUtils, 'safeExists').mockReturnValue(true);

    const orchestratorRule = createMockRule('.ai/agents/orchestrator.md', ['.ai/rules/general.md']);

    const context: ValidationContext = {
      workspaceRoot: '/mock-root',
      config: {
        agentsPath: '.ai/',
        topology: 'orchestrator',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [orchestratorRule],
      repoFiles: [],
    };

    const diags = validateTopology(context);
    expect(diags.some((d) => d.ruleId === 'topology/no-subagents')).toBe(true);
  });

  it('passes if orchestrator references valid subagent on disk', () => {
    vi.spyOn(fsUtils, 'safeExists').mockReturnValue(true);

    const orchestratorRule = createMockRule('.ai/agents/orchestrator.md', ['.ai/agents/frontend.md']);
    const frontendRule = createMockRule('.ai/agents/frontend.md', []);

    const context: ValidationContext = {
      workspaceRoot: '/mock-root',
      config: {
        agentsPath: '.ai/',
        topology: 'orchestrator',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [orchestratorRule, frontendRule],
      repoFiles: ['.ai/agents/orchestrator.md', '.ai/agents/frontend.md'],
    };

    const diags = validateTopology(context);
    expect(diags).toHaveLength(0);
  });

  it('warns in standalone mode if an agent references orchestrator', () => {
    vi.spyOn(fsUtils, 'safeExists').mockReturnValue(false);

    const agentRule = createMockRule('.ai/agents/frontend.md', ['.ai/agents/orchestrator.md']);

    const context: ValidationContext = {
      workspaceRoot: '/mock-root',
      config: {
        agentsPath: '.ai/',
        topology: 'standalone',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: [],
      },
      rules: [agentRule],
      repoFiles: [],
    };

    const diags = validateTopology(context);
    expect(diags.some((d) => d.ruleId === 'topology/standalone-orchestrator-ref')).toBe(true);
    expect(diags[0]?.severity).toBe('warning');
  });
});

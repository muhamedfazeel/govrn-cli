import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../src/parser/frontmatter.js';
import { extractFilePointers } from '../src/parser/markdown.js';
import { generateSarif } from '../src/reporters/sarif.js';
import { resolveAdapters } from '../src/parser/adapters.js';
import { DEFAULT_CONFIG } from '../src/config/index.js';
import type { Diagnostic } from '../src/types/index.js';

describe('Frontmatter Parser', () => {
  it('parses valid YAML frontmatter and extracts globs and description', () => {
    const raw = `---
description: "React Frontend Standards"
globs:
  - "src/**/*.tsx"
  - "src/**/*.ts"
---
# Rules
Use functional components.`;

    const res = parseFrontmatter('rules/react.mdc', raw);
    expect(res.diagnostics).toHaveLength(0);
    expect(res.data.description).toBe('React Frontend Standards');
    expect(res.globs).toEqual(['src/**/*.tsx', 'src/**/*.ts']);
    expect(res.body.trim()).toBe('# Rules\nUse functional components.');
  });

  it('handles comma-separated string globs', () => {
    const raw = `---
globs: "*.ts, *.tsx, *.jsx"
---
Body`;

    const res = parseFrontmatter('test.mdc', raw);
    expect(res.globs).toEqual(['*.ts', '*.tsx', '*.jsx']);
  });

  it('emits error diagnostic on malformed YAML syntax', () => {
    const raw = `---
description: [unclosed array
---
Body`;

    const res = parseFrontmatter('broken.mdc', raw);
    expect(res.diagnostics).toHaveLength(1);
    expect(res.diagnostics[0]?.ruleId).toBe('syntax/invalid-frontmatter');
    expect(res.diagnostics[0]?.severity).toBe('error');
  });
});

describe('Markdown AST Pointer Extractor', () => {
  it('extracts markdown links, @path imports, and explicit .ai references', () => {
    const body = `
# Project Rules
See [frontend standards](.ai/rules/frontend.md) for UI guidelines.
Also check out [legacy](./legacy-rules.md).
Imports:
@.ai/rules/database.md
@AGENTS.md
Refer to \`.ai/skills/git-workflow.md\` for commits.
External link: [Google](https://google.com)
Anchor: [Top](#top)
`;

    const pointers = extractFilePointers(body, '.ai/');
    const targets = pointers.map((p) => p.target);

    expect(targets).toContain('.ai/rules/frontend.md');
    expect(targets).toContain('./legacy-rules.md');
    expect(targets).toContain('.ai/rules/database.md');
    expect(targets).toContain('AGENTS.md');
    expect(targets).toContain('.ai/skills/git-workflow.md');

    // External and anchors must be ignored
    expect(targets).not.toContain('https://google.com');
    expect(targets).not.toContain('#top');
  });
});

describe('Pluggable Adapters Registry', () => {
  it('includes all default built-in adapters', () => {
    const adapters = resolveAdapters(DEFAULT_CONFIG);
    const names = adapters.map((a) => a.name);

    expect(names).toContain('cursor');
    expect(names).toContain('claude');
    expect(names).toContain('copilot');
    expect(names).toContain('gemini');
    expect(names).toContain('codex');
    expect(names).toContain('kiro');
    expect(names).toContain('windsurf');
    expect(names).toContain('ssot');
  });

  it('integrates custom tools defined in config', () => {
    const adapters = resolveAdapters({
      ...DEFAULT_CONFIG,
      customTools: [
        {
          name: 'aider',
          globs: ['.aider.conf.yml'],
        },
      ],
    });

    const names = adapters.map((a) => a.name);
    expect(names).toContain('aider');
    const aider = adapters.find((a) => a.name === 'aider');
    expect(aider?.type).toBe('custom');
    expect(aider?.globs).toEqual(['.aider.conf.yml']);
  });
});

describe('SARIF Reporter', () => {
  it('generates valid SARIF v2.1.0 output', () => {
    const diagnostics: Diagnostic[] = [
      {
        file: 'CLAUDE.md',
        ruleId: 'links/broken-pointer',
        severity: 'error',
        message: 'Broken pointer target',
        line: 10,
        column: 5,
      },
      {
        file: '.cursor/rules/api.mdc',
        ruleId: 'budget/max-tokens-exceeded',
        severity: 'warning',
        message: 'Budget exceeded',
      },
    ];

    const jsonStr = generateSarif(diagnostics);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe('2.1.0');
    expect(parsed.$schema).toContain('sarif-schema-2.1.0.json');
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].tool.driver.name).toBe('govrn-cli');
    expect(parsed.runs[0].results).toHaveLength(2);

    const r1 = parsed.runs[0].results[0];
    expect(r1.ruleId).toBe('links/broken-pointer');
    expect(r1.level).toBe('error');
    expect(r1.locations[0].physicalLocation.artifactLocation.uri).toBe('CLAUDE.md');
    expect(r1.locations[0].physicalLocation.region.startLine).toBe(10);

    const r2 = parsed.runs[0].results[1];
    expect(r2.ruleId).toBe('budget/max-tokens-exceeded');
    expect(r2.level).toBe('warning');
  });
});

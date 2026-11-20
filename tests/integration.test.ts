import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runLint } from '../src/commands/lint.js';

describe('End-to-End Governance Lint Integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'govrn-integ-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs cleanly on a properly governed SSOT repository', async () => {
    // 1. Create .govrnignore
    fs.writeFileSync(
      path.join(tmpDir, '.govrnignore'),
      '.env*\nconfig/secrets/**\nnode_modules/\ndist/\n'
    );

    // 2. Create .ai/ SSOT directory with orchestrator and frontend agent
    fs.mkdirSync(path.join(tmpDir, '.ai/agents'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.ai/rules'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, '.ai/agents/orchestrator.md'),
      `# Main Orchestrator\nCoordinates tasks and delegates to [Frontend](.ai/agents/frontend.md).`
    );

    fs.writeFileSync(
      path.join(tmpDir, '.ai/agents/frontend.md'),
      `# Frontend Agent\nFollows [React Standards](.ai/rules/react.md).`
    );

    fs.writeFileSync(
      path.join(tmpDir, '.ai/rules/react.md'),
      `# React Standards\nUse functional components and hooks.`
    );

    // 3. Create active tool router (CLAUDE.md)
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md'),
      `# Claude Router\n@.ai/agents/orchestrator.md`
    );

    // 4. Create .govrnrc.json
    fs.writeFileSync(
      path.join(tmpDir, '.govrnrc.json'),
      JSON.stringify({
        agentsPath: '.ai/',
        topology: 'orchestrator',
        orchestratorFile: '.ai/agents/orchestrator.md',
        maxTokens: 2000,
        strictGlobs: true,
        sensitivePaths: ['config/secrets/**', '.env*'],
      })
    );

    const result = await runLint({
      cwd: tmpDir,
      format: 'sarif',
    });

    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('catches multiple governance violations in an un-governed repository', async () => {
    // Missing .aiignore, circular dependency between rule1 and rule2, vague rule
    fs.mkdirSync(path.join(tmpDir, '.cursor/rules'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, '.cursor/rules/r1.mdc'),
      `---\nglobs: ["*.ts"]\n---\nRule 1 [Rule 2](.cursor/rules/r2.mdc)\nAlways write clean code.`
    );

    fs.writeFileSync(
      path.join(tmpDir, '.cursor/rules/r2.mdc'),
      `---\nglobs: ["*.ts"]\n---\nRule 2 [Rule 1](.cursor/rules/r1.mdc)`
    );

    // Dummy repo file so globs match
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'console.log(1);');

    const result = await runLint({
      cwd: tmpDir,
      format: 'sarif',
    });

    // Should flag missing .govrnignore (error), DAG circular dependency (error), vague rule (info)
    expect(result.errorCount).toBeGreaterThanOrEqual(2);
    expect(result.diagnostics.some((d) => d.ruleId === 'security/missing-govrnignore')).toBe(true);
    expect(result.diagnostics.some((d) => d.ruleId === 'dag/circular-dependency')).toBe(true);
    expect(result.diagnostics.some((d) => d.ruleId === 'heuristics/vague-rule')).toBe(true);
  });
});

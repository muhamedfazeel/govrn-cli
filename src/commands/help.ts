import pc from 'picocolors';

/**
 * Displays a rich, color-coded help guide and documentation menu.
 */
export function displayHelp(): void {
  console.log();
  console.log(
    pc.bold(pc.cyan('⚡ govrn-cli')) +
      pc.dim(' — Enterprise-Grade AI Context Governance & Validation Engine')
  );
  console.log(pc.dim('Version: 0.1.0 (Phase 1 Static Analysis Foundation)'));
  console.log();

  console.log(pc.bold(pc.yellow('USAGE:')));
  console.log(`  $ ${pc.cyan('govrn-cli')} [command] [options]`);
  console.log(`  $ ${pc.cyan('govrn-cli lint')} --format sarif > results.sarif`);
  console.log();

  console.log(pc.bold(pc.yellow('COMMANDS:')));
  console.log(
    `  ${pc.green('lint')}                     ${pc.white('Validate AI rules, links, token budgets, DAG, and topologies (default)')}`
  );
  console.log(
    `  ${pc.green('help')}                     ${pc.white('Display this comprehensive interactive governance guide')}`
  );
  console.log();

  console.log(pc.bold(pc.yellow('LINT OPTIONS & FLAGS:')));
  console.log(
    `  ${pc.cyan('-f, --format <type>')}       Output format: ${pc.green('terminal')} | ${pc.green('sarif')} (default: terminal)`
  );
  console.log(
    `  ${pc.cyan('-p, --path <dir>')}          Override unified AI context directory path (default: .ai/)`
  );
  console.log(
    `  ${pc.cyan('-t, --topology <mode>')}     Declare topology: ${pc.green('orchestrator')} | ${pc.green('standalone')} | ${pc.green('auto')} (default: auto)`
  );
  console.log(
    `  ${pc.cyan('-h, --help')}                Display command help`
  );
  console.log();

  console.log(pc.bold(pc.yellow('CONFIGURATION (.govrnrc.json):')));
  console.log(pc.dim('  Place a .govrnrc.json in your repository root to configure governance:'));
  console.log();
  console.log(
    pc.cyan(`  {
    "agentsPath": ".ai/",
    "topology": "orchestrator",
    "orchestratorFile": ".ai/agents/orchestrator.md",
    "maxTokens": 2000,
    "strictGlobs": true,
    "sensitivePaths": ["config/secrets/**", ".env*"],
    "customTools": [
      {
        "name": "aider",
        "globs": [".aider.conf.yml", ".aider*"]
      }
    ]
  }`)
  );
  console.log();

  console.log(pc.bold(pc.yellow('SUPPORTED AI CODING TOOLS:')));
  console.log(
    `  • ${pc.bold('Cursor')}:           .cursor/rules/*.mdc (modern), .cursorrules (legacy)`
  );
  console.log(
    `  • ${pc.bold('Claude Code')}:      CLAUDE.md, .claude/**/*`
  );
  console.log(
    `  • ${pc.bold('GitHub Copilot')}:   .github/copilot-instructions.md`
  );
  console.log(
    `  • ${pc.bold('Gemini')}:           GEMINI.md, .gemini/**/*`
  );
  console.log(
    `  • ${pc.bold('Codex / General')}:  AGENTS.md, CODEX.md`
  );
  console.log(
    `  • ${pc.bold('Kiro')}:             .kiro/steering/**/*`
  );
  console.log(
    `  • ${pc.bold('Windsurf')}:         .windsurfrules, .windsurf/rules/**/*`
  );
  console.log(
    `  • ${pc.bold('Custom Tools')}:     Any user tool registered via config.customTools`
  );
  console.log();

  console.log(pc.bold(pc.yellow('SSOT POINTER PATTERNS (.ai/):')));
  console.log(pc.dim('  Tool routers point to centralized rules without copying text:'));
  console.log(
    `  • In ${pc.bold('CLAUDE.md')}:                   ${pc.green('@AGENTS.md')} or ${pc.green('@.ai/agents/claude.md')}`
  );
  console.log(
    `  • In ${pc.bold('.cursor/rules/api.mdc')}:       ${pc.green('[API Standards](.ai/rules/backend.md)')}`
  );
  console.log(
    `  • In ${pc.bold('Orchestrator')}:               ${pc.green('Delegates to [.ai/agents/frontend.md]')}`
  );
  console.log();
}

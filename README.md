# govrn-cli

> **Enterprise-Grade AI Context Governance Engine & CLI**

`govrn-cli` validates AI agent context and rule files across **any** AI coding tool—with built-in adapters for **Cursor** (`.cursor/rules/*.mdc`, `.cursorrules`), **Claude Code** (`CLAUDE.md`, `.claude/`), **GitHub Copilot** (`.github/copilot-instructions.md`), **Gemini** (`GEMINI.md`, `.gemini/`), **Codex** (`AGENTS.md`, `CODEX.md`), **Kiro** (`.kiro/steering/`), and **Windsurf** (`.windsurfrules`), plus **custom user-defined tool paths**.

It prevents context bloat, enforces a Single Source of Truth (SSOT) via a centralized `.ai/` directory, validates both **Orchestrator + Subagents** and **Standalone Agents** topologies, validates globs against the repository, detects circular dependencies, orphan rules, and heuristic conflicts, enforces `.govrnignore` security guardrails, and outputs standard SARIF v2.1.0 for CI/CD pipelines.

---

## Installation

```bash
# Run directly via npx
npx govrn-cli lint

# Or install globally
npm install -g govrn-cli
```

---

## Quick Start

### 1. Run Governance Validation

```bash
# Default terminal report
govrn-cli lint

# CI/CD SARIF output
govrn-cli lint --format sarif > results.sarif

# Override context directory or topology
govrn-cli lint --path custom-context/ --topology orchestrator
```

### 2. View Governance Documentation & Guide

```bash
govrn-cli help
```

---

## Configuration (`.govrnrc.json`)

Configure rules and topology in your workspace root:

```json
{
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
}
```

### Options Reference

| Field | Type | Default | Description |
|---|---|---|---|
| `agentsPath` | `string` | `".ai/"` | Unified directory for rules, skills, and agents |
| `topology` | `"orchestrator" \| "standalone" \| "auto"` | `"auto"` | Declares agent coordination architecture |
| `orchestratorFile` | `string` | `".ai/agents/orchestrator.md"` | Path to the central orchestrator rule |
| `maxTokens` | `number` | `2000` | Compiled token limit before context bloat warning |
| `strictGlobs` | `boolean` | `true` | Warn if a rule glob matches 0 files in repository |
| `sensitivePaths` | `string[]` | `["config/secrets/**", ".env*"]` | Paths that must be covered by `.govrnignore` |
| `customTools` | `Array<{name, globs}>` | `[]` | User-defined AI tool file paths |
| `tools` | `string[]` | `undefined` | Filter which built-in adapters to scan |

---

## SSOT Pointer Architecture

Rather than duplicating rule text across multiple AI tools, `govrn-cli` enables tool-specific files to act as lightweight routers pointing to a Single Source of Truth (`.ai/`):

- **In `CLAUDE.md`:** `@AGENTS.md` or `@.ai/agents/orchestrator.md`
- **In `.cursor/rules/api.mdc`:** `[API Guidelines](.ai/rules/backend.md)`
- **In `Orchestrator`:** `Delegates to [Frontend Subagent](.ai/agents/frontend.md)`

`govrn-cli` expands these pointers in memory to validate true compiled context size, detect broken links, and guard against circular reference chains.

---

## Validation Passes

1. **Broken Pointers & Symlink Portability:** Ensures all markdown links, `@path` imports, and symlinks resolve on disk. Flags non-portable absolute symlinks and relative symlinks that fail on Windows.
2. **DAG Circular Dependency Guard:** Uses DFS on the pointer graph to catch infinite loops (e.g. `A -> B -> A`).
3. **Topology Validator:** Ensures orchestrators delegate to valid subagent definitions, and prevents standalone agents from relying on missing orchestrators.
4. **Compiled Token Budgeting:** Tokenizes the fully expanded cascade using `tiktoken` (`cl100k_base`), catching hidden context bloat.
5. **Glob Validator:** Validates frontmatter glob patterns against actual files in the repository using `micromatch`.
6. **Collision Detector:** Flags legacy `.cursorrules` when modern `.cursor/rules/` or `AGENTS.md` exists, and detects unsynced `CLAUDE.md` and `AGENTS.md` duplicates.
7. **Heuristic Conflict & Scope Validator:** Flags contradictory directive pairs (e.g. `fetch` vs `axios`, `npm` vs `pnpm`), scope mismatches (SQL globs with React UI bodies), and vague instructions (`"write good code"`).
8. **Security & `.govrnignore` Guardrails:** Verifies that `.govrnignore` exists at repo root and protects secrets, API keys, and sensitive paths.

---

## CI/CD Integration (GitHub Actions)

```yaml
name: AI Governance Lint

on: [push, pull_request]

jobs:
  govrn:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx govrn-cli lint --format sarif > govrn.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: govrn.sarif
```

---

## License

Apache-2.0

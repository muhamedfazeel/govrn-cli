# Product Requirements Document (PRD): `govrn-cli`

**Vision:** To provide an enterprise-grade Governance Engine and Scaffolding CLI for AI agent context files across **any** AI coding tool (GitHub Copilot, Cursor, Claude Code, Gemini, Codex, Kiro, Windsurf, Aider, `AGENTS.md`, and custom tool formats). It prevents context bloat, enforces consistency across centralized (`.ai/` SSOT) or distributed architectures, intelligently decides the right agent topology (Orchestrator vs. Independent Agents), and supports **any** user-configured LLM API (Claude API, Gemini, OpenAI, OpenRouter, Bedrock, Ollama, etc.) via BYOK.

## Phase 1: Core Foundation & Static Validation (The MVP)

*Goal: Build the base static analysis engine capable of reading, parsing, and validating AI rules, skills, and agent topologies locally and in CI/CD without requiring an LLM.*

### Milestone 1.1: Configuration, Universal Tool Parsing & CLI Help

* **Configuration Management (`.govrnrc.json`):**

  * Support custom directory path overrides (pointing to a unified directory for `rules/`, `skills/`, and `agents/` if standard paths don't match).

  * Support custom tool definitions (`customTools`) so users can register any current or emerging AI coding tool beyond built-in adapters.

  * Support topology declaration (`topology: "orchestrator" | "standalone" | "auto"`), configurable token budgets, and strictness levels.

* **Multi-Format Parser & Pluggable Core:** Design a core parsing engine with a pluggable adapter architecture covering:

  * Cursor (`.cursor/rules/*.mdc` & legacy `.cursorrules`)

  * Claude Code (`CLAUDE.md`, `.claude/`)

  * GitHub Copilot (`.github/copilot-instructions.md`)

  * Gemini (`GEMINI.md`, `.gemini/`)

  * Codex (`AGENTS.md`, `CODEX.md`)

  * Kiro (`.kiro/steering/`)

  * Windsurf (`.windsurfrules`, `.windsurf/rules/`) & Custom Adapters defined in `.govrnrc.json`

* **Frontmatter & Glob Validation:** Validate YAML frontmatter schemas in `.mdc` and steering files. Verify that `fileMatch` / `globs` patterns are syntactically valid and actually match existing files in the repository.

* **Legacy & Duplication Detection:** Flag conflicting legacy files (e.g., `.cursorrules` existing alongside `.cursor/rules/` or `AGENTS.md`) and detect unsynced duplicates (e.g., `CLAUDE.md` not importing `@AGENTS.md`).

* **Rich Help Interface (`govrn-cli help`):** Provide a color-coded terminal help menu detailing all commands, flags, `.govrnrc.json` schema properties, topology modes, and SSOT pointer examples.

### Milestone 1.2: Dependency Graph, Topology & SSOT Validation

* **Pointer & Symlink Resolution:** Validate that tool-specific router files pointing to the centralized `.ai/` folder (`rules/`, `skills/`, `agents/`) resolve to existing files on disk, including cross-platform symlink checks (Windows compatibility).

* **Agent Topology Validation:**

  * **Orchestrator Mode (`orchestrator`):** Verify that a designated orchestrator rule/agent exists, that every subagent it delegates to resolves to a valid definition in `.ai/agents/`, and that subagent responsibilities don't silently overlap or loop.

  * **Standalone Mode (`standalone`):** Verify that independent agents are self-contained and do not reference a missing central orchestrator.

* **Compiled Token Budgeting (Cascade Effect):** Recursively expand pointers in memory and run `tiktoken` on the *compiled* payload to catch hidden context bloat (warning when exceeding `maxTokens`, default 2,000).

* **Orphan & Dead Code Detection:** Identify files inside `.ai/rules/`, `.ai/skills/`, or `.ai/agents/` that are not referenced by any active AI tool entry point or orchestrator.

* **Circular Dependency Guard (DAG):** Build a Directed Acyclic Graph (DAG) using DFS to prevent infinite reading or delegation loops (e.g., Rule/Agent A pointing to B, which points back to A).

* **Heuristic Conflict & Scope Mismatch Detection:**

  * Flag scope mismatches (e.g., a `.sql` glob pointing to a rule file full of React keywords).

  * Detect likely contradictions without an LLM using keyword heuristics (e.g., Rule A says "always use `fetch`" while Rule B says "prefer `axios`").

  * Flag vague, un-actionable phrasing (e.g., "write good code") that wastes tokens.

### Milestone 1.3: Security & CI/CD Native Output

* **DLP & `.aiignore` Guardrails:** Fail the build if sensitive directories (e.g., `config/secrets/`, `.env*`) are not explicitly excluded in `.aiignore` or are exposed by overly broad rule globs.

* **SARIF Reporter (`--format sarif`):** Output validation results in standard SARIF v2.1.0 format so rule violations appear natively as inline comments in GitHub/GitLab Pull Requests.

## Phase 2: Intelligent Scaffolding, Topology Decision Engine & Monorepos (The DX Upgrade)

*Goal: Solve the cold-start problem with context-aware scaffolding that decides the right agent architecture (Orchestrator vs. Independent Agents), supports complex monorepos, and automates rule compilation.*

### Milestone 2.1: Agent Topology Decision Engine (`init`)

* **Automated Codebase Analysis (Brownfield Projects):**

  * Analyze repository complexity: number of distinct domains (e.g., frontend, backend, database, infra/DevOps, ML), workspace/package count, and cross-cutting workflows.

  * **Decision Logic:**

    * Recommend **Orchestrator + Subagents** when the codebase spans multiple domains, microservices, or complex multi-step workflows (e.g., Planner/Orchestrator delegating to Frontend, Backend, QA, and Security subagents).

    * Recommend **Separate Independent Agents** when the codebase is a focused, single-domain app, library, or CLI where an orchestrator adds unnecessary token overhead and latency.

* **Interactive Architecture Discovery (Greenfield / New Projects):**

  * When run in an empty or newly initialized directory, ask the user targeted questions about what they are going to build (e.g., *"Are you building a single-stack app, a full-stack monolith, or multi-service/monorepo?"*, *"Do you need specialized workflows like DB migrations, API contracts, and UI testing coordinated together?"*).

  * Compute and explain the recommendation (Orchestrator vs. Standalone Agents), while allowing the user to accept or override the choice.

### Milestone 2.2: The "Magic" `init` Scaffolding Engine

* **Architecture Choice:** Interactive prompt allowing users to choose between:

  * **Centralized SSOT:** Scaffolds `.ai/` (`rules/`, `skills/`, `agents/`) and wires up tool-specific files as pointers.

  * **Native / Distributed:** Writes rules directly into the selected tools' native formats without an `.ai/` folder.

* **Deep Environmental Fingerprinting:** Scan `package.json`, lockfiles, ORMs (`prisma/schema.prisma`, `drizzle.config.ts`), styling configs (`tailwind.config.js`), and deployment targets (`vercel.json`, AWS workflows).

* **Linter-to-English Translator:** Parse `.eslintrc` / `eslint.config.js`, `.prettierrc`, and `tsconfig.json` (`strict: true`) and translate them into plain-English AI instructions.

* **Codebase Structural Awareness:** Detect architectural patterns like Next.js App Router (`src/app/`) vs. Pages Router (`src/pages/`) or Feature-Sliced Design (`src/features/`, `src/entities/`, `src/shared/`) to generate tailored boundary rules.

* **Fragment-Based Composition Engine:** Stitch together modular micro-fragments (`/templates/fragments/`) with built-in conflict resolution (e.g., loading `nextjs.md` suppresses `react-router.md`), plus orchestrator/subagent handoff templates when orchestrator mode is chosen.

* **Interactive "Opinion" Toggles:** Rapid-fire CLI prompts for team preferences (e.g., early returns vs. nested `if`, JSDoc density, arrow functions vs. declarations).

### Milestone 2.3: Monorepo & Workspace Support

* **Workspace Detection:** Automatically detect Turborepo, Nx, Lerna, pnpm, or Yarn Workspaces.

* **Cascading Context Inheritance:** Support a root `.ai/` directory combined with workspace-level `.ai/` directories (e.g., `apps/web/.ai/rules/`).

* **Scoped Resolution:** Merge global root rules with workspace-specific rules during validation, allowing local workspace rules to cleanly override global defaults.

### Milestone 2.4: Auto-Fixer, Eject & SSOT Compiler

* **Format Converter (`--fix` / `--migrate-to`):** Automatically migrate legacy `.cursorrules` or unstructured Copilot markdown into modern `.mdc` or `.ai/` SSOT formats.

* **Migration Bridge (`govrn-cli eject`):** Convert a project from Native/Distributed rules into the centralized `.ai/` SSOT architecture when a team adopts additional AI tools.

* **The Context Compiler (`govrn-cli compile`):** A pre-commit hook that flattens `.ai/` pointers directly into proprietary tool files so humans maintain an SSOT while LLMs avoid runtime pointer-following overhead.

## Phase 3: AI-Native Governance (The Enterprise Engine)

*Goal: Introduce universal Bring Your Own Key (BYOK) LLM capabilities so users can plug in any preferred AI API for bespoke rule generation, topology refinement, deep semantic validation, and token compression.*

### Milestone 3.1: Universal BYOK Integration & Secure Config

* **Provider-Agnostic Routing:** Integrate Vercel AI SDK (`@ai-sdk/core`) with a unified provider registry supporting **any** major AI API:

  * **Anthropic (Claude API)** (`@ai-sdk/anthropic`)

  * **Google (Gemini API)** (`@ai-sdk/google`)

  * **OpenAI / Codex API** (`@ai-sdk/openai`)

  * **Enterprise & Aggregators:** AWS Bedrock, Azure OpenAI, Google Vertex AI, OpenRouter, Mistral, DeepSeek

  * **Local & Custom Endpoints:** Ollama, LM Studio (`http://localhost:11434`), and any **OpenAI-compatible custom base URL** for air-gapped or private enterprise models.

* **Local Key Management:** Implement `govrn-cli config set-provider <provider> --model <model> --key <key> [--base-url <url>]` storing credentials securely in `~/.config/govrn-cli/.env` (never committed to the repo).

* **CI/CD Environment Variables:** Automatically detect standard and prefixed environment variables (`GOVRN_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, etc.).

### Milestone 3.2: Dynamic `init`, Semantic Validation & Smart Caching

* **LLM-Powered `init` & Topology Refinement:** When any AI provider is configured, sample actual source files (hooks, utilities, schemas, directory layout) to generate bespoke architectural rules and fine-tune the Orchestrator vs. Subagent boundaries.

* **Deep Semantic Validation (`govrn-cli lint --ai`):** Detect nuanced logical contradictions across rule files, flag overlapping subagent responsibilities, and audit tone/actionability with concrete rewrite suggestions.

* **Smart Validation Cache (`.govrn-cache.json`):** Hash rule file contents so CI/CD only invokes the LLM when rule files actually change, eliminating latency and API waste on normal application commits.

### Milestone 3.3: AI Minification Engine

* **Prompt Compression (`govrn-cli optimize`):** Rewrite and densify bloated rule files by stripping conversational filler while preserving all technical constraints.

## Phase 4: Ecosystem & Visualization (The Workflow Integration)

*Goal: Provide real-time developer feedback loops in the terminal and IDE, plus extensible community sharing.*

### Milestone 4.1: Simulation & Coverage

* **The Rule Simulator (`govrn-cli simulate --target <path>`):** Output the exact rule files, agent topology routing, and load order that will trigger when an AI agent edits a specific file path.

* **Glob Coverage Heatmap (`govrn-cli coverage`):** Render a terminal tree showing the percentage of the codebase covered by AI rules and highlighting unregulated directories.

### Milestone 4.2: Editor Native Integrations

* **Language Server Protocol (LSP):** Encapsulate the CLI's parsing and validation engine in a lightweight LSP.

* **IDE Extensions:** Release VS Code, Cursor, and JetBrains extensions for real-time token budgeting and glob-validation diagnostics while editing rule files.

### Milestone 4.3: Extensibility & Community Registry

* **Remote Templates (`govrn-cli init --template <repo>`):** Fetch community or private corporate rule/orchestrator templates directly from GitHub repositories.

* **Plugin Ecosystem:** Publish official and community adapter plugins (e.g., `@govrn/plugin-cursor`, `@govrn/plugin-kiro`, `@govrn/plugin-claude`) for emerging AI coding tools.

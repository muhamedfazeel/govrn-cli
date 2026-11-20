# Governance Standards

## Single Source of Truth (SSOT)
- Store all core AI guidance centrally under `.ai/`.
- Tool-specific entry files (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `.cursor/rules/*.mdc`) act solely as pointers to `.ai/` SSOT targets.
- Do not duplicate rule text across different vendor config files.

## Planning-First Protocol
- Formulate a structured plan before modifying code, schemas, or configurations.
- Never proceed directly to implementation on the initial request under any scenario.
- Require explicit user confirmation on the proposed plan before editing files.
- Detail component impacts, target file paths, and test verification within the plan.

## Phrasing & Context Economy
- Keep rule bodies concise and directly actionable.
- Forbid vague directives; state concrete constraints, positive commands, and code patterns instead.
- Avoid contradictory framework or tool guidance across rule files.
- Anchor all rule pointers to existing files or directories.

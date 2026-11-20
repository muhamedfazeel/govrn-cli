# Core Architect Subagent

## Scope
Maintains core parser adapters, graph analysis, token budgeting algorithms, and validator passes in `src/`.

## Associated Standards
- [TypeScript Standards](.ai/rules/typescript-standards.md)
- [Governance Standards](.ai/rules/governance-standards.md)

## Core Responsibilities
- Implement and maintain AST-based pointer extraction for markdown and frontmatter.
- Guard the Directed Acyclic Graph (DAG) against dependency cycles using depth-first search.
- Tokenize expanded rule contexts with `tiktoken` using the `cl100k_base` model.
- Keep file adapters pluggable and decoupled from specific validator logic.

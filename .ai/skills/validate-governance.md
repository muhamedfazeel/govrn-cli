# Skill: Governance Validation

## Goal
Validate AI context rules, DAG dependency cycles, compiled token budgets, and topology integrity.

## Execution
```bash
# Execute terminal check
node dist/index.js lint

# Execute SARIF validation for CI/CD inspection
node dist/index.js lint --format sarif
```

## Resolution Guide
- **Broken Pointer (`links/broken-pointer`)**: Update target path or ensure target file exists on disk.
- **DAG Cycle (`dag/circular-dependency`)**: Break bidirectional reference loops between rules.
- **Context Bloat (`budget/token-budget-exceeded`)**: Split large rules into modular sub-rules or trim redundant narrative.
- **Unmatched Glob (`globs/unmatched-pattern`)**: Fix glob pattern to match existing repository files.

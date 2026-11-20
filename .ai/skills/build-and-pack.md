# Skill: Build and Pack

## Goal
Compile TypeScript source into production distribution artifacts and verify packaging integrity.

## Execution Sequence
1. Check types:
   ```bash
   npm run typecheck
   ```
2. Execute test suite:
   ```bash
   npm test
   ```
3. Compile with tsup:
   ```bash
   npm run build
   ```
4. Verify bundle contents:
   ```bash
   npm pack --dry-run
   ```

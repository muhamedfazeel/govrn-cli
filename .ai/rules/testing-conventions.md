# Testing Conventions

## Framework & Execution
- Run tests via `npm test` using Vitest.
- Group related test cases under descriptive `describe` and `it` blocks.

## Test Workspace Isolation
- Never mutate workspace files directly inside tests.
- Allocate isolated test workspaces with `fs.mkdtempSync(path.join(os.tmpdir(), 'govrn-test-'))`.
- Always clean up temporary directories in an `afterEach` hook using `fs.rmSync(tmpDir, { recursive: true, force: true })`.

## Diagnostic Verification
- Verify diagnostic counts and rule identifiers explicitly (`ruleId: 'dag/circular-dependency'`).
- Test both passing governance states and intentional failure edge cases.

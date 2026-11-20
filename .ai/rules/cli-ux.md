# CLI UX Standards

## Terminal Output & Coloration
- Use `picocolors` for terminal highlighting, warnings, and error messages.
- Reserve red for errors, yellow for warnings, and cyan or dim text for file paths and line metadata.
- Wrap terminal messages to fit within standard 80-column terminal displays.

## Process Exit Codes & Error Handling
- Exit with code `0` when linting completes with 0 errors.
- Exit with code `1` when one or more diagnostics have `error` severity.
- Output machine-readable formats cleanly without injecting unsolicited terminal decoration.

# TypeScript Standards

## Module & Import Conventions
- Use pure ECMAScript Modules (ESM).
- Prefix Node.js built-ins with `node:` (e.g. `import path from 'node:path'`).
- Suffix relative file imports with `.js` extension (e.g. `import type { GovrnConfig } from '../types/index.js'`).

## Type Safety & Schema Validation
- Maintain strict type safety across all interfaces and utility functions.
- Do not use `any`; use `unknown` combined with type narrowing or type guards.
- Validate configuration inputs, external parameters, and CLI arguments using Zod schemas.
- Place shared domain interfaces and type definitions in `src/types/index.ts`.

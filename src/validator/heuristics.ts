import type { Diagnostic, ParsedRule, ValidationContext } from '../types/index.js';
import { resolvePointerPath } from './links.js';

interface ContradictionPattern {
  id: string;
  name: string;
  regexA: RegExp;
  regexB: RegExp;
  labelA: string;
  labelB: string;
}

const CONTRADICTION_PATTERNS: ContradictionPattern[] = [
  {
    id: 'fetch-vs-axios',
    name: 'HTTP Client',
    regexA: /\b(prefer|use|always|enforce)\s+fetch\b/i,
    regexB: /\b(prefer|use|always|enforce)\s+axios\b/i,
    labelA: 'use fetch',
    labelB: 'use axios',
  },
  {
    id: 'npm-vs-pnpm',
    name: 'Package Manager',
    regexA: /\b(prefer|use|always|enforce)\s+npm\b/i,
    regexB: /\b(prefer|use|always|enforce)\s+(pnpm|yarn|bun)\b/i,
    labelA: 'use npm',
    labelB: 'use pnpm/yarn/bun',
  },
  {
    id: 'tabs-vs-spaces',
    name: 'Indentation',
    regexA: /\b(prefer|use|always|enforce)\s+tabs\b/i,
    regexB: /\b(prefer|use|always|enforce)\s+spaces\b/i,
    labelA: 'use tabs',
    labelB: 'use spaces',
  },
  {
    id: 'jest-vs-vitest',
    name: 'Test Framework',
    regexA: /\b(prefer|use|always|enforce)\s+jest\b/i,
    regexB: /\b(prefer|use|always|enforce)\s+vitest\b/i,
    labelA: 'use jest',
    labelB: 'use vitest',
  },
  {
    id: 'tailwind-vs-css-in-js',
    name: 'Styling Strategy',
    regexA: /\b(prefer|use|always|enforce)\s+tailwind\b/i,
    regexB: /\b(prefer|use|always|enforce)\s+(styled-components|emotion|vanilla-extract)\b/i,
    labelA: 'use tailwind',
    labelB: 'use css-in-js (styled-components/emotion)',
  },
  {
    id: 'arrow-vs-function',
    name: 'Function Declaration',
    regexA: /\b(prefer|use|always|enforce)\s+arrow\s+functions?\b/i,
    regexB: /\b(prefer|use|always|enforce)\s+function\s+declarations?\b/i,
    labelA: 'use arrow functions',
    labelB: 'use function declarations',
  },
];

const VAGUE_PHRASES: Array<{ pattern: RegExp; raw: string }> = [
  { pattern: /\bwrite\s+(clean|good|high[\s-]quality|better)\s+code\b/i, raw: 'write good/clean code' },
  { pattern: /\bmake\s+it\s+(modern|pretty|nice|clean)\b/i, raw: 'make it modern' },
  { pattern: /\bfollow\s+best\s+practices\b/i, raw: 'follow best practices' },
  { pattern: /\bensure\s+(high\s+quality|it\s+works\s+well)\b/i, raw: 'ensure high quality' },
  { pattern: /\bwrite\s+efficient\s+code\b/i, raw: 'write efficient code' },
];

/**
 * Validates heuristic contradictions, scope mismatches, and vague phrasing.
 */
export function validateHeuristics(context: ValidationContext): Diagnostic[] {
  const { workspaceRoot, rules } = context;
  const diagnostics: Diagnostic[] = [];

  // Index rules by path
  const ruleMap = new Map<string, ParsedRule>();
  for (const r of rules) {
    ruleMap.set(r.path, r);
  }

  // 1. Keyword-pair contradiction detection across rules
  for (const pattern of CONTRADICTION_PATTERNS) {
    const matchedRulesA: Array<{ rule: ParsedRule; line?: number }> = [];
    const matchedRulesB: Array<{ rule: ParsedRule; line?: number }> = [];

    for (const rule of rules) {
      const lines = rule.body.split('\n');

      lines.forEach((lineText, idx) => {
        if (pattern.regexA.test(lineText)) {
          matchedRulesA.push({ rule, line: idx + 1 });
        }
        if (pattern.regexB.test(lineText)) {
          matchedRulesB.push({ rule, line: idx + 1 });
        }
      });
    }

    // Flag contradictions if different rules advocate opposing choices
    for (const itemA of matchedRulesA) {
      for (const itemB of matchedRulesB) {
        if (itemA.rule.path !== itemB.rule.path) {
          diagnostics.push({
            file: itemA.rule.path,
            ruleId: 'heuristics/contradictory-directives',
            severity: 'warning',
            message: `Contradictory directives detected for ${pattern.name}: '${itemA.rule.path}' specifies '${pattern.labelA}' (line ${itemA.line ?? 1}) while '${itemB.rule.path}' specifies '${pattern.labelB}' (line ${itemB.line ?? 1}).`,
            line: itemA.line,
          });
        }
      }
    }
  }

  // 2. Scope / content mismatch checks
  for (const rule of rules) {
    if (!rule.globs || rule.globs.length === 0) continue;

    // Check if globs are strictly backend/database
    const isDbOnly = rule.globs.every(
      (g) => g.endsWith('.sql') || g.endsWith('.prisma') || g.includes('migration')
    );

    // Check if globs are strictly frontend
    const isFrontendOnly = rule.globs.every(
      (g) => g.endsWith('.tsx') || g.endsWith('.jsx') || g.endsWith('.css') || g.endsWith('.vue')
    );

    // Get combined content to check: rule body + direct pointer targets
    let combinedContent = rule.body;
    for (const ptr of rule.pointers) {
      const { relativePath } = resolvePointerPath(workspaceRoot, rule.path, ptr.target);
      const targetRule = ruleMap.get(relativePath);
      if (targetRule) {
        combinedContent += '\n' + targetRule.body;
      }
    }

    if (isDbOnly) {
      const frontendKeywords = ['react', 'usestate', 'useeffect', 'tailwind', 'jsx', 'component', 'props'];
      const matched = frontendKeywords.filter((kw) =>
        new RegExp(`\\b${kw}\\b`, 'i').test(combinedContent)
      );

      if (matched.length >= 2) {
        diagnostics.push({
          file: rule.path,
          ruleId: 'heuristics/scope-mismatch',
          severity: 'warning',
          message: `Scope mismatch: Globs exclusively target database/SQL files (${rule.globs.join(', ')}), but rule body contains frontend UI directives (${matched.join(', ')}).`,
        });
      }
    }

    if (isFrontendOnly) {
      const dbKeywords = ['sql', 'foreign key', 'database table', 'migration script', 'pg_dump'];
      const matched = dbKeywords.filter((kw) =>
        new RegExp(`\\b${kw}\\b`, 'i').test(combinedContent)
      );

      if (matched.length >= 2) {
        diagnostics.push({
          file: rule.path,
          ruleId: 'heuristics/scope-mismatch',
          severity: 'warning',
          message: `Scope mismatch: Globs exclusively target frontend files (${rule.globs.join(', ')}), but rule body contains database/migration directives (${matched.join(', ')}).`,
        });
      }
    }
  }

  // 3. Vague-rule linter
  for (const rule of rules) {
    const lines = rule.body.split('\n');

    lines.forEach((lineText, idx) => {
      // Ignore comment lines or headings
      const trimmed = lineText.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

      for (const vague of VAGUE_PHRASES) {
        if (vague.pattern.test(lineText)) {
          diagnostics.push({
            file: rule.path,
            ruleId: 'heuristics/vague-rule',
            severity: 'info',
            message: `Vague directive '${vague.raw}' detected. Replace with actionable constraints, specific coding conventions, or command examples to conserve context tokens.`,
            line: idx + 1,
          });
        }
      }
    });
  }

  return diagnostics;
}

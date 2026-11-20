import matter from 'gray-matter';
import YAML from 'yaml';
import type { Diagnostic } from '../types/index.js';

export interface FrontmatterResult {
  data: Record<string, unknown>;
  body: string;
  globs: string[];
  diagnostics: Diagnostic[];
}

/**
 * Extracts and parses YAML frontmatter from rule files.
 * Reports syntax errors as error diagnostics.
 */
export function parseFrontmatter(fileRelativePath: string, rawContent: string): FrontmatterResult {
  const diagnostics: Diagnostic[] = [];
  let data: Record<string, unknown> = {};
  let body = rawContent;
  const globs: string[] = [];

  // Check if content appears to have frontmatter
  if (rawContent.startsWith('---')) {
    try {
      const parsed = matter(rawContent, {
        engines: {
          yaml: (str: string) => YAML.parse(str),
        },
      });
      data = (parsed.data as Record<string, unknown>) ?? {};
      body = parsed.content;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      diagnostics.push({
        file: fileRelativePath,
        ruleId: 'syntax/invalid-frontmatter',
        severity: 'error',
        message: `YAML frontmatter parsing failed: ${message}`,
        line: 1,
      });
      // Fallback: strip leading --- if possible
      const secondDelim = rawContent.indexOf('---', 3);
      if (secondDelim !== -1) {
        body = rawContent.slice(secondDelim + 3);
      }
    }
  }

  // Extract globs from known frontmatter fields (Cursor .mdc, Kiro, etc.)
  if (data.globs) {
    if (Array.isArray(data.globs)) {
      globs.push(...data.globs.map((g) => String(g).trim()).filter(Boolean));
    } else if (typeof data.globs === 'string') {
      // Could be comma or newline separated
      const split = data.globs.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      globs.push(...split);
    }
  }

  if (data.fileMatch) {
    if (Array.isArray(data.fileMatch)) {
      globs.push(...data.fileMatch.map((g) => String(g).trim()).filter(Boolean));
    } else if (typeof data.fileMatch === 'string') {
      const split = data.fileMatch.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
      globs.push(...split);
    }
  }

  return {
    data,
    body,
    globs,
    diagnostics,
  };
}

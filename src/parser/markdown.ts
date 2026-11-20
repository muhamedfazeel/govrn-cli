import { fromMarkdown } from 'mdast-util-from-markdown';
import type { FilePointer } from '../types/index.js';

interface AstNode {
  type: string;
  url?: string;
  value?: string;
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  children?: AstNode[];
}

/**
 * Checks if a URL is an external web link or anchor.
 */
function isExternalOrAnchor(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('tel:')
  );
}

/**
 * Cleans anchor fragments or query params from local file paths.
 */
function cleanPath(target: string): string {
  const withoutAnchor = target.split('#')[0] ?? '';
  const withoutQuery = withoutAnchor.split('?')[0] ?? '';
  return withoutQuery.trim();
}

/**
 * Parses markdown body and extracts all local file pointers and SSOT references.
 */
export function extractFilePointers(
  markdownBody: string,
  agentsPath: string
): FilePointer[] {
  const pointers: FilePointer[] = [];
  const normalizedAgentsPath = agentsPath.replace(/\/+$/, '');

  let tree: AstNode;
  try {
    tree = fromMarkdown(markdownBody) as AstNode;
  } catch {
    // If AST parsing fails unexpectedly, fallback to regex scanning
    return extractPointersViaRegex(markdownBody, normalizedAgentsPath);
  }

  function walk(node: AstNode) {
    if (!node) return;

    // 1. Markdown Links & Definitions
    if (node.type === 'link' || node.type === 'definition' || node.type === 'image') {
      if (node.url && !isExternalOrAnchor(node.url)) {
        const cleaned = cleanPath(node.url);
        if (cleaned.length > 0) {
          pointers.push({
            target: cleaned,
            raw: node.url,
            line: node.position?.start.line,
            column: node.position?.start.column,
          });
        }
      }
    }

    // 2. Text and Inline Code: scan for @path imports and agentsPath references
    if (node.type === 'text' || node.type === 'inlineCode') {
      const text = node.value || '';
      const line = node.position?.start.line;
      const column = node.position?.start.column;

      // Match @path syntax (e.g., @.ai/rules/db.md, @AGENTS.md, @./rules/foo.md)
      const atMatches = text.matchAll(/(?:^|[\s(])@([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)/g);
      for (const m of atMatches) {
        const target = m[1];
        if (target && !target.includes('@')) {
          pointers.push({
            target: cleanPath(target),
            raw: m[0].trim(),
            line,
            column,
          });
        }
      }

      // Match explicit paths starting with agentsPath (e.g., .ai/rules/foo.md, .ai/skills/bar)
      const escaped = normalizedAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ssotRegex = new RegExp(`(?:^|[\\s\`(])(${escaped}[a-zA-Z0-9_./\\-]*)`, 'g');
      const ssotMatches = text.matchAll(ssotRegex);
      for (const m of ssotMatches) {
        const target = m[1];
        if (target) {
          const cleaned = cleanPath(target);
          if (cleaned.length > 0) {
            pointers.push({
              target: cleaned,
              raw: m[0].trim(),
              line,
              column,
            });
          }
        }
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(tree);

  // Deduplicate by target and line
  const seen = new Set<string>();
  const uniquePointers: FilePointer[] = [];
  for (const p of pointers) {
    const key = `${p.target}:${p.line ?? 0}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePointers.push(p);
    }
  }

  return uniquePointers;
}

/**
 * Fallback regex scanner if AST fails.
 */
function extractPointersViaRegex(body: string, normalizedAgentsPath: string): FilePointer[] {
  const pointers: FilePointer[] = [];
  const lines = body.split('\n');

  const mdLinkRegex = /\[.*?\]\(([^)]+)\)/g;
  const atRegex = /(?:^|[\s(])@([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)/g;
  const escaped = normalizedAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ssotRegex = new RegExp(`(?:^|[\\s\`(])(${escaped}[a-zA-Z0-9_./\\-]*)`, 'g');

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;

    for (const match of lineText.matchAll(mdLinkRegex)) {
      const url = match[1];
      if (url && !isExternalOrAnchor(url)) {
        pointers.push({
          target: cleanPath(url),
          raw: match[0],
          line: lineNum,
        });
      }
    }

    for (const match of lineText.matchAll(atRegex)) {
      const target = match[1];
      if (target) {
        pointers.push({
          target: cleanPath(target),
          raw: match[0].trim(),
          line: lineNum,
        });
      }
    }

    for (const match of lineText.matchAll(ssotRegex)) {
      const target = match[1];
      if (target) {
        pointers.push({
          target: cleanPath(target),
          raw: match[0].trim(),
          line: lineNum,
        });
      }
    }
  });

  return pointers;
}

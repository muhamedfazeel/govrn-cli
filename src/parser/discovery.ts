import path from 'node:path';
import fg from 'fast-glob';
import type { Diagnostic, GovrnConfig, ParsedRule, ToolAdapter } from '../types/index.js';
import { resolveAdapters } from './adapters.js';
import { parseFrontmatter } from './frontmatter.js';
import { extractFilePointers } from './markdown.js';
import { inspectSymlink, safeReadFile, toPosixPath } from '../utils/fs.js';

export interface DiscoveryResult {
  rules: ParsedRule[];
  repoFiles: string[];
  adapters: ToolAdapter[];
  diagnostics: Diagnostic[];
}

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
];

/**
 * Discovers and parses all AI rule files across active adapters and SSOT directory.
 */
export async function discoverRules(
  workspaceRoot: string,
  config: GovrnConfig
): Promise<DiscoveryResult> {
  const diagnostics: Diagnostic[] = [];
  const adapters = resolveAdapters(config);

  // 1. Discover all files in repository for glob matching and orphan checks
  const repoFilesRaw = await fg(['**/*'], {
    cwd: workspaceRoot,
    ignore: DEFAULT_IGNORE,
    dot: true,
    onlyFiles: true,
  });
  const repoFiles = repoFilesRaw.map(toPosixPath);

  // 2. Discover rule files matching adapters
  const foundFileMap = new Map<
    string,
    {
      filePath: string;
      adapter: ToolAdapter;
      isLegacy: boolean;
    }
  >();

  for (const adapter of adapters) {
    // Standard globs
    if (adapter.globs.length > 0) {
      const files = await fg(adapter.globs, {
        cwd: workspaceRoot,
        ignore: DEFAULT_IGNORE,
        dot: true,
        onlyFiles: true,
      });

      for (const f of files) {
        const posixPath = toPosixPath(f);
        if (!foundFileMap.has(posixPath)) {
          foundFileMap.set(posixPath, { filePath: posixPath, adapter, isLegacy: false });
        }
      }
    }

    // Legacy globs
    if (adapter.legacyGlobs && adapter.legacyGlobs.length > 0) {
      const legacyFiles = await fg(adapter.legacyGlobs, {
        cwd: workspaceRoot,
        ignore: DEFAULT_IGNORE,
        dot: true,
        onlyFiles: true,
      });

      for (const lf of legacyFiles) {
        const posixPath = toPosixPath(lf);
        if (!foundFileMap.has(posixPath)) {
          foundFileMap.set(posixPath, { filePath: posixPath, adapter, isLegacy: true });
        }
      }
    }
  }

  // 3. Parse each discovered rule file
  const parsedRules: ParsedRule[] = [];

  for (const [relPath, item] of foundFileMap.entries()) {
    const absPath = path.resolve(workspaceRoot, relPath);
    const symlinkInfo = inspectSymlink(absPath);
    const rawContent = safeReadFile(absPath);

    // Frontmatter parsing
    const { data: frontmatter, body, globs, diagnostics: fDiagnostics } = parseFrontmatter(
      relPath,
      rawContent
    );
    diagnostics.push(...fDiagnostics);

    // AST markdown parsing
    const pointers = extractFilePointers(body, config.agentsPath);

    parsedRules.push({
      path: relPath,
      absolutePath: absPath,
      adapter: item.adapter.name,
      content: rawContent,
      body,
      frontmatter,
      pointers,
      globs,
      isLegacy: item.isLegacy,
      isSymlink: symlinkInfo.isSymlink,
      symlinkTarget: symlinkInfo.target,
      isBrokenSymlink: symlinkInfo.isBroken,
    });
  }

  return {
    rules: parsedRules,
    repoFiles,
    adapters,
    diagnostics,
  };
}

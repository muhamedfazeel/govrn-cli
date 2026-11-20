import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { GovrnConfig } from '../types/index.js';

export const customToolSchema = z.object({
  name: z.string().min(1, 'Custom tool name cannot be empty'),
  globs: z.array(z.string().min(1)).min(1, 'Custom tool must specify at least one glob pattern'),
});

export const govrnConfigSchema = z.object({
  agentsPath: z.string().default('.ai/'),
  topology: z.enum(['orchestrator', 'standalone', 'auto']).default('auto'),
  orchestratorFile: z.string().optional(),
  customTools: z.array(customToolSchema).optional(),
  maxTokens: z.number().int().positive().default(2000),
  strictGlobs: z.boolean().default(true),
  sensitivePaths: z.array(z.string()).default(['config/secrets/**', '.env*']),
  tools: z.array(z.string()).optional(),
});

export type RawGovrnConfig = z.infer<typeof govrnConfigSchema>;

export const DEFAULT_CONFIG: GovrnConfig = {
  agentsPath: '.ai/',
  topology: 'auto',
  orchestratorFile: '.ai/agents/orchestrator.md',
  maxTokens: 2000,
  strictGlobs: true,
  sensitivePaths: ['config/secrets/**', '.env*'],
};

/**
 * Normalizes directory paths to use posix separators and end with a slash if appropriate.
 */
export function normalizeAgentsPath(p: string): string {
  let normalized = p.replace(/\\/g, '/').trim();
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  if (!normalized.endsWith('/')) {
    normalized += '/';
  }
  return normalized;
}

/**
 * Loads and validates .govrnrc.json from the workspace root.
 * Merges loaded values with defaults and runtime overrides.
 */
export async function loadConfig(
  workspaceRoot: string,
  overrides?: Partial<GovrnConfig>
): Promise<GovrnConfig> {
  const configPath = path.resolve(workspaceRoot, '.govrnrc.json');
  let rawJson: unknown = {};

  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      rawJson = JSON.parse(fileContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse .govrnrc.json at ${configPath}: ${message}`);
    }
  }

  const parsed = govrnConfigSchema.safeParse(rawJson);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => ` - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid .govrnrc.json configuration:\n${issues}`);
  }

  const data = parsed.data;
  const agentsPath = overrides?.agentsPath
    ? normalizeAgentsPath(overrides.agentsPath)
    : normalizeAgentsPath(data.agentsPath);

  const orchestratorFile =
    overrides?.orchestratorFile ??
    data.orchestratorFile ??
    `${agentsPath}agents/orchestrator.md`;

  const merged: GovrnConfig = {
    agentsPath,
    topology: overrides?.topology ?? data.topology,
    orchestratorFile: orchestratorFile.replace(/\\/g, '/'),
    customTools: overrides?.customTools ?? data.customTools,
    maxTokens: overrides?.maxTokens ?? data.maxTokens,
    strictGlobs: overrides?.strictGlobs ?? data.strictGlobs,
    sensitivePaths: overrides?.sensitivePaths ?? data.sensitivePaths,
    tools: overrides?.tools ?? data.tools,
  };

  return merged;
}

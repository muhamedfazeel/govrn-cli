/**
 * Severity levels for governance diagnostics.
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * Diagnostic emitted by govrn-cli validators.
 */
export interface Diagnostic {
  file: string;
  ruleId: string;
  severity: DiagnosticSeverity;
  message: string;
  line?: number;
  column?: number;
}

/**
 * Supported agent topologies.
 */
export type TopologyMode = 'orchestrator' | 'standalone' | 'auto';

/**
 * Custom tool definition for user-defined AI coding tools.
 */
export interface CustomToolConfig {
  name: string;
  globs: string[];
}

/**
 * Complete runtime configuration for govrn-cli.
 */
export interface GovrnConfig {
  /** Unified directory for rules, skills, and agents (default: .ai/) */
  agentsPath: string;
  /** Topology mode (default: auto) */
  topology: TopologyMode;
  /** Central orchestrator file path (default: .ai/agents/orchestrator.md) */
  orchestratorFile: string;
  /** Custom user-defined AI tool path definitions */
  customTools?: CustomToolConfig[];
  /** Maximum token budget before warning (default: 2000) */
  maxTokens: number;
  /** Flag warning if frontmatter globs match 0 files in repo (default: true) */
  strictGlobs: boolean;
  /** Sensitive paths that must be covered by .govrnignore (default: ['config/secrets/**', '.env*']) */
  sensitivePaths: string[];
  /** Optional filter to restrict which built-in adapters run */
  tools?: string[];
}

/**
 * Pluggable AI tool path adapter interface.
 */
export interface ToolAdapter {
  name: string;
  description: string;
  globs: string[];
  legacyGlobs?: string[];
  type: 'native' | 'legacy' | 'custom' | 'ssot';
}

/**
 * Extracted link/pointer from a rule markdown AST.
 */
export interface FilePointer {
  target: string;
  raw: string;
  line?: number;
  column?: number;
}

/**
 * Parsed rule file representation in memory.
 */
export interface ParsedRule {
  path: string;
  absolutePath: string;
  adapter: string;
  content: string;
  body: string;
  frontmatter: Record<string, unknown>;
  pointers: FilePointer[];
  globs: string[];
  isLegacy: boolean;
  isSymlink: boolean;
  symlinkTarget?: string;
  isBrokenSymlink?: boolean;
}

/**
 * Validation context passed to validators.
 */
export interface ValidationContext {
  workspaceRoot: string;
  config: GovrnConfig;
  rules: ParsedRule[];
  repoFiles: string[];
}

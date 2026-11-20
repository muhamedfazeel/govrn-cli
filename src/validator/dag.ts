import type { Diagnostic, ParsedRule, ValidationContext } from '../types/index.js';
import { resolvePointerPath } from './links.js';

export interface GraphCycle {
  path: string[];
}

/**
 * Builds an adjacency list representation of the rule pointer graph.
 */
export function buildRuleGraph(
  workspaceRoot: string,
  rules: ParsedRule[]
): Map<string, Set<string>> {
  const rulePaths = new Set(rules.map((r) => r.path));
  const graph = new Map<string, Set<string>>();

  for (const rule of rules) {
    if (!graph.has(rule.path)) {
      graph.set(rule.path, new Set());
    }

    const neighbors = graph.get(rule.path)!;

    // Follow symlinks if present
    if (rule.isSymlink && rule.symlinkTarget) {
      const { relativePath } = resolvePointerPath(
        workspaceRoot,
        rule.path,
        rule.symlinkTarget
      );
      if (rulePaths.has(relativePath)) {
        neighbors.add(relativePath);
      }
    }

    // Follow extracted pointers
    for (const pointer of rule.pointers) {
      const { relativePath } = resolvePointerPath(
        workspaceRoot,
        rule.path,
        pointer.target
      );
      if (rulePaths.has(relativePath)) {
        neighbors.add(relativePath);
      }
    }
  }

  return graph;
}

/**
 * Canonicalizes a cycle array so [A, B, A] and [B, A, B] produce the same key.
 */
function canonicalizeCycle(cycle: string[]): string {
  // Exclude last repeating element
  const nodes = cycle.slice(0, -1);
  if (nodes.length === 0) return '';

  let minIdx = 0;
  for (let i = 1; i < nodes.length; i++) {
    const current = nodes[i];
    const minNode = nodes[minIdx];
    if (current && minNode && current < minNode) {
      minIdx = i;
    }
  }

  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
  const first = rotated[0];
  if (first) {
    rotated.push(first);
  }
  return rotated.join(' -> ');
}

/**
 * Detects circular dependencies in the rule pointer graph using DFS.
 */
export function detectCycles(graph: Map<string, Set<string>>): GraphCycle[] {
  enum State {
    UNVISITED,
    VISITING,
    VISITED,
  }

  const state = new Map<string, State>();
  const parent = new Map<string, string | null>();
  const detectedCycles: GraphCycle[] = [];
  const seenCycleKeys = new Set<string>();

  for (const node of graph.keys()) {
    state.set(node, State.UNVISITED);
  }

  function dfs(current: string, currentPath: string[]) {
    state.set(current, State.VISITING);
    currentPath.push(current);

    const neighbors = graph.get(current) ?? new Set();
    for (const neighbor of neighbors) {
      const neighborState = state.get(neighbor) ?? State.UNVISITED;

      if (neighborState === State.VISITING) {
        // Cycle detected: extract subpath from neighbor to current and back to neighbor
        const cycleStartIndex = currentPath.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          const cyclePath = [...currentPath.slice(cycleStartIndex), neighbor];
          const canonicalKey = canonicalizeCycle(cyclePath);

          if (!seenCycleKeys.has(canonicalKey)) {
            seenCycleKeys.add(canonicalKey);
            detectedCycles.push({ path: cyclePath });
          }
        }
      } else if (neighborState === State.UNVISITED) {
        parent.set(neighbor, current);
        dfs(neighbor, currentPath);
      }
    }

    currentPath.pop();
    state.set(current, State.VISITED);
  }

  for (const node of graph.keys()) {
    if (state.get(node) === State.UNVISITED) {
      dfs(node, []);
    }
  }

  return detectedCycles;
}

/**
 * Validates that the rule graph is a Directed Acyclic Graph (DAG).
 */
export function validateDAG(context: ValidationContext): Diagnostic[] {
  const { workspaceRoot, rules } = context;
  const diagnostics: Diagnostic[] = [];

  const graph = buildRuleGraph(workspaceRoot, rules);
  const cycles = detectCycles(graph);

  for (const cycle of cycles) {
    const cycleStr = cycle.path.join(' -> ');
    const originFile = cycle.path[0] ?? 'unknown';

    diagnostics.push({
      file: originFile,
      ruleId: 'dag/circular-dependency',
      severity: 'error',
      message: `Circular dependency detected in rule graph: ${cycleStr}`,
    });
  }

  return diagnostics;
}

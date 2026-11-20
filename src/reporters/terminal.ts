import pc from 'picocolors';
import type { Diagnostic } from '../types/index.js';

export interface ReporterSummary {
  filesScanned: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Formats and prints diagnostics to the terminal with rich colors and grouping.
 */
export function reportTerminal(
  diagnostics: Diagnostic[],
  summary: ReporterSummary
): void {
  console.log();
  console.log(pc.bold(pc.cyan('⚡ govrn-cli')) + ' ' + pc.dim('AI Context Governance Engine'));
  console.log();

  if (diagnostics.length === 0) {
    console.log(
      pc.green('✔') +
        ' ' +
        pc.bold(pc.green('All AI context files adhere to governance policies!')) +
        ' ' +
        pc.dim(`(${summary.filesScanned} files scanned)`)
    );
    console.log();
    return;
  }

  // Group diagnostics by file
  const grouped = new Map<string, Diagnostic[]>();
  for (const diag of diagnostics) {
    const list = grouped.get(diag.file) ?? [];
    list.push(diag);
    grouped.set(diag.file, list);
  }

  for (const [file, items] of grouped.entries()) {
    console.log(pc.bold(pc.underline(file)));

    for (const item of items) {
      const lineStr = item.line ? pc.dim(`:${item.line}`) : '';
      let badge: string;

      if (item.severity === 'error') {
        badge = pc.bgRed(pc.white(pc.bold(' ERROR ')));
      } else if (item.severity === 'warning') {
        badge = pc.bgYellow(pc.black(pc.bold(' WARN ')));
      } else {
        badge = pc.bgBlue(pc.white(pc.bold(' INFO ')));
      }

      const ruleTag = pc.dim(`(${item.ruleId})`);
      console.log(`  ${badge}${lineStr} ${item.message} ${ruleTag}`);
    }
    console.log();
  }

  // Final summary bar
  console.log(pc.dim('─'.repeat(60)));
  const errorPart = summary.errorCount > 0 ? pc.red(pc.bold(`${summary.errorCount} error(s)`)) : pc.green('0 errors');
  const warnPart = summary.warningCount > 0 ? pc.yellow(pc.bold(`${summary.warningCount} warning(s)`)) : pc.dim('0 warnings');
  const infoPart = summary.infoCount > 0 ? pc.blue(`${summary.infoCount} info`) : pc.dim('0 info');

  console.log(
    `Summary: ${errorPart}, ${warnPart}, ${infoPart} across ${pc.bold(summary.filesScanned)} rule file(s) scanned.`
  );

  if (summary.errorCount > 0) {
    console.log(pc.red(pc.bold('✖ Governance check failed.')));
  } else if (summary.warningCount > 0) {
    console.log(pc.yellow(pc.bold('⚠ Governance check passed with warnings.')));
  } else {
    console.log(pc.green(pc.bold('✔ Governance check passed.')));
  }
  console.log();
}

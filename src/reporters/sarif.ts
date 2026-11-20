import type { Diagnostic } from '../types/index.js';

export interface SarifLog {
  $schema: string;
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: Array<{
          id: string;
          shortDescription: { text: string };
          defaultConfiguration: {
            level: 'error' | 'warning' | 'note';
          };
        }>;
      };
    };
    results: Array<{
      ruleId: string;
      level: 'error' | 'warning' | 'note';
      message: { text: string };
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string; uriBaseId: string };
          region?: {
            startLine: number;
            startColumn?: number;
          };
        };
      }>;
    }>;
  }>;
}

/**
 * Maps govrn-cli severity to SARIF result levels.
 */
function toSarifLevel(sev: Diagnostic['severity']): 'error' | 'warning' | 'note' {
  if (sev === 'error') return 'error';
  if (sev === 'warning') return 'warning';
  return 'note';
}

/**
 * Converts diagnostic results into SARIF v2.1.0 JSON format for CI/CD integration.
 */
export function generateSarif(diagnostics: Diagnostic[]): string {
  // Collect unique rules
  const ruleMap = new Map<
    string,
    { id: string; shortDescription: { text: string }; defaultConfiguration: { level: 'error' | 'warning' | 'note' } }
  >();

  for (const diag of diagnostics) {
    if (!ruleMap.has(diag.ruleId)) {
      ruleMap.set(diag.ruleId, {
        id: diag.ruleId,
        shortDescription: { text: `govrn-cli check: ${diag.ruleId}` },
        defaultConfiguration: { level: toSarifLevel(diag.severity) },
      });
    }
  }

  const results = diagnostics.map((diag) => {
    const loc: {
      physicalLocation: {
        artifactLocation: { uri: string; uriBaseId: string };
        region?: { startLine: number; startColumn?: number };
      };
    } = {
      physicalLocation: {
        artifactLocation: {
          uri: diag.file,
          uriBaseId: '%SRCROOT%',
        },
      },
    };

    if (diag.line) {
      loc.physicalLocation.region = {
        startLine: diag.line,
        startColumn: diag.column,
      };
    }

    return {
      ruleId: diag.ruleId,
      level: toSarifLevel(diag.severity),
      message: { text: diag.message },
      locations: [loc],
    };
  });

  const sarif: SarifLog = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'govrn-cli',
            version: '0.1.0',
            informationUri: 'https://github.com/govrn-cli/govrn-cli',
            rules: Array.from(ruleMap.values()),
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

/**
 * Emits SARIF report directly to stdout.
 */
export function reportSarif(diagnostics: Diagnostic[]): void {
  const output = generateSarif(diagnostics);
  console.log(output);
}

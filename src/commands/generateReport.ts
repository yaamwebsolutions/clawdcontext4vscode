import * as vscode from 'vscode';
import { state, analyzeWorkspace } from './analyzeWorkspace';

/**
 * Generate a markdown context health report and open it in a new editor.
 */
export async function generateReport(): Promise<void> {
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const b = state.budget;
  const lr = state.lintResult;

  const lines = [
    '# ClawdContext — Context Health Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## CER',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| CER | ${(b.cer * 100).toFixed(1)}% (${b.cerStatus}) |`,
    `| Budget | ${b.totalBudget.toLocaleString()} |`,
    `| Always Loaded | ${b.alwaysLoadedTokens.toLocaleString()} |`,
    `| Headroom | ${b.reasoningHeadroom.toLocaleString()} |`,
    '',
  ];

  if (lr && lr.securityReports.length > 0) {
    lines.push(
      '## Security',
      '',
      '| Skill | Score | Verdict | Active | Suppressed |',
      '|-------|-------|---------|--------|------------|',
    );
    for (const r of lr.securityReports) {
      const active = r.findings.filter(f => !f.suppressed).length;
      lines.push(`| ${r.file.relativePath} | ${r.score}/100 | ${r.verdict} | ${active} | ${r.suppressedCount} |`);
    }
  }

  if (lr && lr.positionalWarnings > 0) {
    lines.push(
      '',
      '## Positional',
      `${lr.positionalWarnings} critical instructions in dead zone.`,
    );
  }

  lines.push('', '---', `*ClawdContext v${getVersion()}*`);

  await vscode.window.showTextDocument(
    await vscode.workspace.openTextDocument({
      content: lines.join('\n'),
      language: 'markdown',
    }),
  );
}

function getVersion(): string {
  try {
    const ext = vscode.extensions.getExtension('clawdcontext.clawdcontext');
    return ext?.packageJSON?.version ?? '0.3.0';
  } catch {
    return '0.3.0';
  }
}

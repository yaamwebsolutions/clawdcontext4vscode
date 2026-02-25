/**
 * Dashboard Export — save analysis state as JSON or Markdown artifacts.
 *
 * Useful for CI/CD integration, team reporting, and historical tracking.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { state, analyzeWorkspace } from './analyzeWorkspace';
import { detectActivePreset } from './configPresets';
import { isAiEnabled, getAiConfig } from '../ai';

// ─── Types ──────────────────────────────────────────────────────────

interface DashboardExport {
  version: string;
  timestamp: string;
  preset: string;
  cer: {
    ratio: number;
    status: string;
    totalBudget: number;
    alwaysLoadedTokens: number;
    onDemandTokens: number;
    reasoningHeadroom: number;
  };
  layers: Array<{
    name: string;
    files: number;
    tokens: number;
  }>;
  files: Array<{
    path: string;
    layer: string;
    tokens: number;
    alwaysLoaded: boolean;
  }>;
  security: Array<{
    file: string;
    score: number;
    verdict: string;
    activeFindings: number;
    suppressedFindings: number;
  }>;
  ai: {
    enabled: boolean;
    provider: string;
    model: string;
  };
}

// ─── Export Command ─────────────────────────────────────────────────

/**
 * Export the dashboard state to a file.
 * User picks JSON or Markdown format.
 */
export async function exportDashboard(): Promise<void> {
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const format = await vscode.window.showQuickPick(
    [
      { label: '📄 JSON', description: 'Machine-readable, CI/CD friendly', value: 'json' },
      { label: '📝 Markdown', description: 'Human-readable report', value: 'markdown' },
    ],
    { title: 'Export Dashboard', placeHolder: 'Choose export format' },
  );

  if (!format) { return; }

  const data = buildExportData();
  const content = format.value === 'json'
    ? JSON.stringify(data, null, 2)
    : buildMarkdownExport(data);

  const ext = format.value === 'json' ? 'json' : 'md';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const defaultName = `clawdcontext-report-${timestamp}.${ext}`;

  // Ask where to save
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(
      path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', defaultName),
    ),
    filters: format.value === 'json'
      ? { 'JSON': ['json'] }
      : { 'Markdown': ['md'] },
    title: 'Save Dashboard Export',
  });

  if (!uri) { return; }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  vscode.window.showInformationMessage(`✅ Dashboard exported to ${vscode.workspace.asRelativePath(uri)}`);

  // Optionally open the file
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: true });
}

// ─── Data Builder ───────────────────────────────────────────────────

function buildExportData(): DashboardExport {
  const b = state.budget!;
  const lr = state.lintResult;
  const aiConfig = getAiConfig();

  const layerNames = ['hook', 'kernel', 'skill', 'task', 'learning', 'subagent'] as const;

  return {
    version: getVersion(),
    timestamp: new Date().toISOString(),
    preset: detectActivePreset(),
    cer: {
      ratio: Math.round(b.cer * 10000) / 10000,
      status: b.cerStatus,
      totalBudget: b.totalBudget,
      alwaysLoadedTokens: b.alwaysLoadedTokens,
      onDemandTokens: b.onDemandTokens,
      reasoningHeadroom: b.reasoningHeadroom,
    },
    layers: layerNames.map(name => {
      const files = b.filesByLayer.get(name) || [];
      return {
        name,
        files: files.length,
        tokens: files.reduce((s, f) => s + f.tokens, 0),
      };
    }).filter(l => l.files > 0),
    files: b.allFiles.map(f => ({
      path: f.relativePath,
      layer: f.layer,
      tokens: f.tokens,
      alwaysLoaded: f.alwaysLoaded,
    })),
    security: (lr?.securityReports || []).map(r => ({
      file: r.file.relativePath,
      score: r.score,
      verdict: r.verdict,
      activeFindings: r.findings.filter(f => !f.suppressed).length,
      suppressedFindings: r.suppressedCount,
    })),
    ai: {
      enabled: isAiEnabled(),
      provider: aiConfig.provider,
      model: aiConfig.model,
    },
  };
}

function buildMarkdownExport(data: DashboardExport): string {
  const lines = [
    '# ClawdContext Dashboard Export',
    '',
    `**Generated:** ${data.timestamp}`,
    `**Version:** ${data.version}`,
    `**Preset:** ${data.preset}`,
    '',
    '## Context Efficiency Ratio',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| CER | ${(data.cer.ratio * 100).toFixed(1)}% |`,
    `| Status | ${data.cer.status} |`,
    `| Budget | ${data.cer.totalBudget.toLocaleString()} tokens |`,
    `| Always-Loaded | ${data.cer.alwaysLoadedTokens.toLocaleString()} tokens |`,
    `| On-Demand | ${data.cer.onDemandTokens.toLocaleString()} tokens |`,
    `| Headroom | ${data.cer.reasoningHeadroom.toLocaleString()} tokens |`,
    '',
    '## Layer Distribution',
    '',
    '| Layer | Files | Tokens |',
    '|-------|-------|--------|',
    ...data.layers.map(l =>
      `| ${l.name} | ${l.files} | ${l.tokens.toLocaleString()} |`,
    ),
    '',
    '## Files',
    '',
    '| File | Layer | Tokens | Always Loaded |',
    '|------|-------|--------|---------------|',
    ...data.files.map(f =>
      `| ${f.path} | ${f.layer} | ${f.tokens.toLocaleString()} | ${f.alwaysLoaded ? '✅' : '—'} |`,
    ),
  ];

  if (data.security.length > 0) {
    lines.push(
      '',
      '## Security',
      '',
      '| File | Score | Verdict | Active | Suppressed |',
      '|------|-------|---------|--------|------------|',
      ...data.security.map(s =>
        `| ${s.file} | ${s.score}/100 | ${s.verdict} | ${s.activeFindings} | ${s.suppressedFindings} |`,
      ),
    );
  }

  lines.push(
    '',
    '## AI',
    '',
    `| Setting | Value |`,
    `|---------|-------|`,
    `| Enabled | ${data.ai.enabled ? 'Yes' : 'No'} |`,
    `| Provider | ${data.ai.provider} |`,
    `| Model | ${data.ai.model || '—'} |`,
    '',
    '---',
    `_ClawdContext v${data.version}_`,
  );

  return lines.join('\n');
}

function getVersion(): string {
  try {
    const ext = vscode.extensions.getExtension('clawdcontext.clawdcontext');
    return ext?.packageJSON?.version ?? '0.4.0';
  } catch {
    return '0.4.0';
  }
}

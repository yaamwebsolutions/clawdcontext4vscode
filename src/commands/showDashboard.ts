import * as vscode from 'vscode';
import type { ContextBudget } from '../analyzers/tokenAnalyzer';
import { analyzePositionalAttention } from '../analyzers/tokenAnalyzer';
import type { LintResult } from '../analyzers/diagnosticsProvider';
import { state } from './analyzeWorkspace';
import { isAiEnabled, getAiConfig, getProviderLabel, getEffectiveTokenBudget } from '../ai';

/**
 * Open the CER dashboard webview panel.
 */
export function showDashboard(): void {
  if (!state.budget) {
    vscode.window.showWarningMessage('Analyze workspace first.');
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'clawdcontextDashboard',
    'ClawdContext Dashboard',
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  panel.webview.html = getDashboardHtml(state.budget, state.lintResult);

  // Handle interactive button messages from webview
  panel.webview.onDidReceiveMessage(
    async (message: { command: string }) => {
      switch (message.command) {
        case 'exportDashboard':
          vscode.commands.executeCommand('clawdcontext.exportDashboard');
          break;
        case 'cerDiff':
          vscode.commands.executeCommand('clawdcontext.cerDiff');
          break;
        case 'applyPreset':
          vscode.commands.executeCommand('clawdcontext.applyPreset');
          break;
        case 'aiReviewConfig':
          vscode.commands.executeCommand('clawdcontext.aiReviewConfig');
          break;
        case 'aiValidate':
          vscode.commands.executeCommand('clawdcontext.aiValidate');
          break;
        case 'aiGenerate':
          vscode.commands.executeCommand('clawdcontext.aiGenerate');
          break;
        case 'aiContradictions':
          vscode.commands.executeCommand('clawdcontext.aiContradictions');
          break;
        case 'scaffoldMarkdownOS':
          vscode.commands.executeCommand('clawdcontext.scaffoldMarkdownOS');
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'clawdcontext');
          break;
        case 'lintMdFiles':
          vscode.commands.executeCommand('clawdcontext.lintMdFiles');
          break;
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Dashboard HTML Generator
// ---------------------------------------------------------------------------

function getDashboardHtml(budget: ContextBudget, lintResult: LintResult | null): string {
  const cerPct = (budget.cer * 100).toFixed(1);
  const cerColor = budget.cerStatus === 'optimal'
    ? '#059669'
    : budget.cerStatus === 'warning'
      ? '#D97706'
      : '#DC2626';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClawdContext Dashboard</title>
<style>${getDashboardCss(cerColor)}</style>
</head>
<body>
<h1>ClawdContext Dashboard</h1>
<p class="sub">Markdown OS — Context Health Monitor</p>

${renderCerCard(cerPct, cerColor, budget)}
${renderMetrics(budget)}
<div class="g2">
  ${renderLayerBars(budget)}
  ${renderWhatIf(cerPct, cerColor, budget)}
</div>
${renderSecurityTable(lintResult)}
${renderPositionalMap(budget)}
${renderAiStatus()}
${renderActionButtons()}

<p class="quote">"Treat context like OS memory: budget it, compact it, page it intelligently."</p>
<p class="footer">ClawdContext — ${budget.allFiles.length} files · ${(budget.alwaysLoadedTokens + budget.onDemandTokens).toLocaleString()} total tokens</p>

<script>${getWhatIfScript(budget)}${getActionButtonsScript()}</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Render helpers — each returns an HTML string
// ---------------------------------------------------------------------------

function renderCerCard(cerPct: string, cerColor: string, budget: ContextBudget): string {
  return `<div class="card cerc">
  <div class="cerl">Context Efficiency Ratio</div>
  <div class="cerv" style="color:${cerColor}">${cerPct}%</div>
  <div class="cers" style="color:${cerColor}">${budget.cerStatus.toUpperCase()}</div>
</div>`;
}

function renderMetrics(budget: ContextBudget): string {
  const m = (val: string, label: string) =>
    `<div class="metric"><div class="mv">${val}</div><div class="ml">${label}</div></div>`;
  const { source, model } = getEffectiveTokenBudget();
  const budgetLabel = source === 'model'
    ? `Budget (${model})`
    : source === 'user'
      ? 'Budget (manual)'
      : 'Budget (default)';
  return `<div class="metrics">
  ${m(`${(budget.totalBudget / 1000).toFixed(0)}K`, budgetLabel)}
  ${m(`${(budget.alwaysLoadedTokens / 1000).toFixed(1)}K`, 'Always Loaded')}
  ${m(`${(budget.onDemandTokens / 1000).toFixed(1)}K`, 'On-Demand')}
  ${m(`${(budget.reasoningHeadroom / 1000).toFixed(1)}K`, 'Headroom')}
  ${m(`${budget.allFiles.length}`, 'Agent Files')}
</div>`;
}

function renderLayerBars(budget: ContextBudget): string {
  const layerLabels: Record<string, string> = {
    hook: '⛔ Hooks', kernel: '🧬 Kernel', skill: '📘 Skills',
    task: '📋 Tasks', learning: '🧠 Lessons', subagent: '🔬 Subagents',
  };
  const layerColors: Record<string, string> = {
    hook: '#DC2626', kernel: '#7C3AED', skill: '#2563EB',
    task: '#059669', learning: '#D97706', subagent: '#0891B2',
  };

  const layerData = (['hook', 'kernel', 'skill', 'task', 'learning', 'subagent'] as const)
    .map(key => {
      const files = budget.filesByLayer.get(key) || [];
      return { key, tokens: files.reduce((s, f) => s + f.tokens, 0), files: files.length };
    })
    .filter(d => d.files > 0);

  const maxTokens = Math.max(...layerData.map(d => d.tokens), 1);

  const bars = layerData.map(d => {
    const pct = ((d.tokens / maxTokens) * 100).toFixed(0);
    return `<div class="lbr">
      <div class="lbl">${layerLabels[d.key] || d.key}</div>
      <div class="lbt"><div class="lbf" style="width:${pct}%;background:${layerColors[d.key] || '#666'}"></div></div>
      <div class="lbv">${(d.tokens / 1000).toFixed(1)}K</div>
    </div>`;
  }).join('\n');

  return `<div class="card"><h2>Token Budget by Layer</h2>${bars}</div>`;
}

function renderWhatIf(cerPct: string, cerColor: string, budget: ContextBudget): string {
  return `<div class="card whatif"><h2>What-If Simulator</h2>
  <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Simulate adding tokens to always-loaded context:</p>
  <div class="wh">
    <label>Additional: <strong id="wt">0</strong></label>
    <div class="wr" id="wc" style="color:${cerColor}">${cerPct}%</div>
  </div>
  <input type="range" id="ws" min="0" max="${budget.totalBudget}" value="0" step="500" style="accent-color:${cerColor}"/>
  <div class="wl"><span>+0</span><span>+${(budget.totalBudget / 2000).toFixed(0)}K</span><span>+${(budget.totalBudget / 1000).toFixed(0)}K</span></div>
  <div id="wst" style="font-size:12px;margin-top:6px;color:var(--muted)"></div>
</div>`;
}

function renderSecurityTable(lintResult: LintResult | null): string {
  const reports = lintResult?.securityReports || [];
  if (reports.length === 0) { return ''; }

  const clean = reports.filter(r => r.verdict === 'clean').length;
  const suspicious = reports.filter(r => r.verdict === 'suspicious').length;
  const dangerous = reports.filter(r => r.verdict === 'dangerous').length;

  const rows = reports.map(r => {
    const c = r.verdict === 'clean' ? '#059669' : r.verdict === 'suspicious' ? '#D97706' : '#DC2626';
    const activeCount = r.findings.filter(f => !f.suppressed).length;
    const suppLabel = r.suppressedCount > 0 ? ` <span style="color:var(--muted);font-weight:normal;font-size:11px">(${r.suppressedCount} suppressed)</span>` : '';
    return `<tr><td>${r.file.relativePath}</td><td style="color:${c};font-weight:600">${r.score}/100</td><td style="color:${c}">${r.verdict.toUpperCase()}</td><td>${activeCount}${suppLabel}</td></tr>`;
  }).join('\n');

  return `<div class="card"><h2>🔒 Security Scan</h2>
  <div class="sec-s">
    ${clean > 0 ? `<span class="sb sc">✓ ${clean} clean</span>` : ''}
    ${suspicious > 0 ? `<span class="sb ss">⚠ ${suspicious} suspicious</span>` : ''}
    ${dangerous > 0 ? `<span class="sb sd">✕ ${dangerous} dangerous</span>` : ''}
  </div>
  <table><thead><tr><th>Skill</th><th>Score</th><th>Verdict</th><th>Findings</th></tr></thead>
  <tbody>${rows}</tbody></table></div>`;
}

function renderPositionalMap(budget: ContextBudget): string {
  const items = budget.allFiles
    .filter(f => f.alwaysLoaded && f.content.split('\n').length >= 6)
    .map(f => {
      const zones = analyzePositionalAttention(f.content);
      if (zones.length === 0) { return ''; }
      const middle = zones.find(z => z.zone === 'middle');
      const critical = middle?.criticalInstructions.length || 0;
      if (critical === 0) { return ''; }
      return `<div class="pos-file">
        <div class="pos-label">${f.relativePath}</div>
        <div class="pos-bar">
          <div class="pos-zone pos-start" style="width:33%"><span>75%</span></div>
          <div class="pos-zone pos-middle" style="width:34%"><span>55% ⚠️ ${critical}</span></div>
          <div class="pos-zone pos-end" style="width:33%"><span>70%</span></div>
        </div>
      </div>`;
    }).filter(Boolean).join('\n');

  if (!items) { return ''; }

  return `<div class="card"><h2>📍 Positional Attention Map</h2>
  <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Stanford Lost-in-the-Middle: attention by position. Critical instructions in red zone are at risk.</p>
  ${items}</div>`;
}

function renderAiStatus(): string {
  const config = getAiConfig();
  const enabled = isAiEnabled();

  if (config.provider === 'none') {
    return `<div class="card ai-card">
  <h2>🤖 AI Features</h2>
  <div class="ai-off">Disabled <span style="color:var(--muted);font-size:12px">— Set <code>clawdcontext.ai.provider</code> in settings to enable</span></div>
</div>`;
  }

  const providerLbl = getProviderLabel(config.provider);
  const statusColor = enabled ? '#059669' : '#D97706';
  const statusText = enabled ? 'Ready' : 'Missing API Key';
  const certLabel = config.caCertPath ? `✅ Custom CA loaded` : 'System CAs';
  const tlsLabel = config.rejectUnauthorized ? 'Verified' : '⚠️ Disabled';

  return `<div class="card ai-card">
  <h2>🤖 AI Features</h2>
  <div class="ai-grid">
    <div class="ai-item"><span class="ai-label">Provider</span><span class="ai-val">${providerLbl}</span></div>
    <div class="ai-item"><span class="ai-label">Model</span><span class="ai-val">${config.model}</span></div>
    <div class="ai-item"><span class="ai-label">Status</span><span class="ai-val" style="color:${statusColor};font-weight:600">${statusText}</span></div>
    <div class="ai-item"><span class="ai-label">TLS</span><span class="ai-val">${tlsLabel}</span></div>
    <div class="ai-item"><span class="ai-label">Certificates</span><span class="ai-val">${certLabel}</span></div>
    <div class="ai-item"><span class="ai-label">Endpoint</span><span class="ai-val" style="font-size:11px">${config.baseUrl}</span></div>
  </div>
</div>`;
}

function renderActionButtons(): string {
  const aiEnabled = isAiEnabled();
  const aiButtons = aiEnabled ? `
    <button class="action-btn action-ai" data-command="aiReviewConfig">🤖 AI Review</button>
    <button class="action-btn action-ai" data-command="aiValidate">🔍 AI Validate</button>
    <button class="action-btn action-ai" data-command="aiGenerate">✨ AI Generate</button>
    <button class="action-btn action-ai" data-command="aiContradictions">⚡ Contradictions</button>
  ` : '';

  return `<div class="card actions-card">
  <h2>⚡ Quick Actions</h2>
  <div class="action-row">
    <button class="action-btn action-primary" data-command="exportDashboard">📥 Export</button>
    <button class="action-btn action-primary" data-command="cerDiff">📊 CER Diff</button>
    <button class="action-btn action-primary" data-command="applyPreset">⚙️ Presets</button>
    <button class="action-btn action-primary" data-command="lintMdFiles">🔒 Security Scan</button>
    <button class="action-btn action-primary" data-command="scaffoldMarkdownOS">📝 Scaffold</button>
    <button class="action-btn action-secondary" data-command="openSettings">⚙ Settings</button>
    ${aiButtons}
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// CSS + JS (kept separate for readability)
// ---------------------------------------------------------------------------

function getDashboardCss(cerColor: string): string {
  return `:root{--bg:var(--vscode-editor-background);--fg:var(--vscode-editor-foreground);--border:var(--vscode-widget-border);--widget:var(--vscode-editorWidget-background);--muted:var(--vscode-descriptionForeground)}
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;background:var(--bg);color:var(--fg);max-width:900px;margin:0 auto}
h1{font-size:20px;margin-bottom:2px}h2{font-size:14px;margin-top:24px;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}
.sub{color:var(--muted);margin-bottom:20px;font-size:13px}
.card{background:var(--widget);border:1px solid var(--border);border-radius:8px;padding:18px;margin-bottom:14px}
.cerc{text-align:center}.cerv{font-size:56px;font-weight:800;line-height:1}.cerl{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);margin-bottom:4px}.cers{font-size:13px;font-weight:600;margin-top:4px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.metric{background:var(--widget);border:1px solid var(--border);border-radius:6px;padding:12px}
.mv{font-size:22px;font-weight:700}.ml{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:600px){.g2,.metrics{grid-template-columns:1fr}}
.lbr{display:flex;align-items:center;margin-bottom:5px}.lbl{width:105px;font-size:12px;flex-shrink:0}.lbt{flex:1;height:18px;background:var(--border);border-radius:3px;overflow:hidden}.lbf{height:100%;border-radius:3px}.lbv{width:50px;text-align:right;font-size:12px;font-weight:600;flex-shrink:0;margin-left:8px}
.whatif label{font-size:12px;color:var(--muted)}.wh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.wr{font-size:20px;font-weight:700;transition:color .2s}
.wl{display:flex;justify-content:space-between;font-size:10px;color:var(--muted)}
.sec-s{display:flex;gap:10px;margin-bottom:10px}.sb{padding:3px 9px;border-radius:12px;font-size:12px;font-weight:600}
.sc{background:#05966920;color:#059669}.ss{background:#D9770620;color:#D97706}.sd{background:#DC262620;color:#DC2626}
table{width:100%;border-collapse:collapse}th{text-align:left;padding:5px 8px;border-bottom:2px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}td{padding:5px 8px;border-bottom:1px solid var(--border);font-size:13px}
.pos-file{margin-bottom:8px}.pos-label{font-size:12px;margin-bottom:3px}.pos-bar{display:flex;height:26px;border-radius:4px;overflow:hidden;border:1px solid var(--border)}
.pos-zone{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600}
.pos-start{background:#05966940;color:#059669}.pos-middle{background:#DC262630;color:#DC2626}.pos-end{background:#2563EB30;color:#2563EB}
.quote{font-style:italic;color:var(--muted);border-left:3px solid ${cerColor};padding-left:12px;margin-top:20px;font-size:13px}
.footer{text-align:center;color:var(--muted);font-size:11px;margin-top:20px}
.ai-card{margin-top:14px}.ai-off{font-size:13px;color:var(--muted)}.ai-off code{background:var(--border);padding:1px 5px;border-radius:3px;font-size:12px}
.ai-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.ai-item{display:flex;flex-direction:column}.ai-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}.ai-val{font-size:13px;margin-top:2px}
.actions-card{margin-top:14px}.action-row{display:flex;flex-wrap:wrap;gap:8px}
.action-btn{border:1px solid var(--border);background:var(--widget);color:var(--fg);padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:4px}
.action-btn:hover{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.action-primary{border-color:#2563EB40}.action-primary:hover{background:#2563EB;color:#fff;border-color:#2563EB}
.action-secondary{border-color:var(--muted)}.action-secondary:hover{background:var(--muted);color:var(--bg)}
.action-ai{border-color:#7C3AED40}.action-ai:hover{background:#7C3AED;color:#fff;border-color:#7C3AED}`;
}

function getWhatIfScript(budget: ContextBudget): string {
  return `const sl=document.getElementById('ws'),te=document.getElementById('wt'),ce=document.getElementById('wc'),se=document.getElementById('wst');
const tb=${budget.totalBudget},cl=${budget.alwaysLoadedTokens};
sl.addEventListener('input',()=>{const a=parseInt(sl.value),nl=cl+a,nc=Math.max(0,(tb-nl)/tb),np=(nc*100).toFixed(1);
te.textContent=a.toLocaleString();ce.textContent=np+'%';
let s,c;if(nc>.6){s='OPTIMAL';c='#059669'}else if(nc>.3){s='WARNING';c='#D97706'}else{s='CRITICAL — Heat death imminent';c='#DC2626'}
ce.style.color=c;se.innerHTML='<span style="color:'+c+';font-weight:600">'+s+'</span> — '+(nl/1000).toFixed(1)+'K / '+(tb/1000).toFixed(0)+'K loaded';});`;
}

function getActionButtonsScript(): string {
  return `
const vscode=acquireVsCodeApi();
document.querySelectorAll('.action-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const cmd=btn.getAttribute('data-command');
    if(cmd){vscode.postMessage({command:cmd});}
  });
});`;
}

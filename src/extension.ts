import * as vscode from 'vscode';
import type { ContextBudget} from './analyzers/tokenAnalyzer';
import { scanWorkspace, calculateBudget, analyzePositionalAttention } from './analyzers/tokenAnalyzer';
import type { LintResult } from './analyzers/diagnosticsProvider';
import { createDiagnosticCollection, lintAllFiles } from './analyzers/diagnosticsProvider';
import { LayersTreeProvider, HealthTreeProvider, LessonsTreeProvider } from './providers/treeProvider';
import { LessonsCodeLensProvider } from './providers/codeLensProvider';
import { StatusBarManager } from './providers/statusBar';
import { ClawdContextCodeActionProvider, extractProcedureCommand, moveToLessonsCommand, archiveDeprecatedCommand, analyzeBloatCommand } from './providers/codeActionProvider';
import { scaffoldMarkdownOS } from './utils/scaffold';

let currentBudget: ContextBudget | null = null;
let currentLintResult: LintResult | null = null;
let diagnosticCollection: vscode.DiagnosticCollection;
let layersTree: LayersTreeProvider;
let healthTree: HealthTreeProvider;
let lessonsTree: LessonsTreeProvider;
let codeLensProvider: LessonsCodeLensProvider;
let statusBar: StatusBarManager;

export function activate(context: vscode.ExtensionContext) {
  console.log('ClawdContext v0.2.0 activated');
  diagnosticCollection = createDiagnosticCollection();
  context.subscriptions.push(diagnosticCollection);
  layersTree = new LayersTreeProvider();
  healthTree = new HealthTreeProvider();
  lessonsTree = new LessonsTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('clawdcontext.layers', layersTree),
    vscode.window.registerTreeDataProvider('clawdcontext.health', healthTree),
    vscode.window.registerTreeDataProvider('clawdcontext.lessons', lessonsTree),
  );
  codeLensProvider = new LessonsCodeLensProvider();
  context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/lessons*.md' }, codeLensProvider));
  const codeActionProvider = new ClawdContextCodeActionProvider();
  context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
    { pattern: '**/*.md' }, codeActionProvider,
    { providedCodeActionKinds: ClawdContextCodeActionProvider.providedCodeActionKinds }
  ));
  statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);
  context.subscriptions.push(
    vscode.commands.registerCommand('clawdcontext.analyzeWorkspace', analyzeWorkspace),
    vscode.commands.registerCommand('clawdcontext.showDashboard', showDashboard),
    vscode.commands.registerCommand('clawdcontext.lintMdFiles', lintMdFiles),
    vscode.commands.registerCommand('clawdcontext.pruneLessons', pruneLessons),
    vscode.commands.registerCommand('clawdcontext.promoteLessons', promoteLessons),
    vscode.commands.registerCommand('clawdcontext.generateReport', generateReport),
    vscode.commands.registerCommand('clawdcontext.scaffoldMarkdownOS', scaffoldMarkdownOS),
    vscode.commands.registerCommand('clawdcontext.refreshTree', analyzeWorkspace),
    vscode.commands.registerCommand('clawdcontext.extractProcedure', extractProcedureCommand),
    vscode.commands.registerCommand('clawdcontext.moveToLessons', moveToLessonsCommand),
    vscode.commands.registerCommand('clawdcontext.archiveDeprecated', archiveDeprecatedCommand),
    vscode.commands.registerCommand('clawdcontext.analyzeBloat', analyzeBloatCommand),
  );
  const watcher = vscode.workspace.createFileSystemWatcher('**/{CLAUDE,AGENTS,SKILL,lessons,todo,plan}.md');
  watcher.onDidChange(() => analyzeWorkspace());
  watcher.onDidCreate(() => analyzeWorkspace());
  watcher.onDidDelete(() => analyzeWorkspace());
  context.subscriptions.push(watcher);
  analyzeWorkspace();
}

async function analyzeWorkspace(): Promise<void> {
  const files = await scanWorkspace();
  currentBudget = calculateBudget(files);
  layersTree.refresh(currentBudget);
  healthTree.refresh(currentBudget);
  lessonsTree.refresh(currentBudget);
  statusBar.update(currentBudget);
  codeLensProvider.refresh();
  currentLintResult = lintAllFiles(currentBudget, diagnosticCollection);
}

async function lintMdFiles(): Promise<void> {
  await analyzeWorkspace();
  if (currentBudget && currentLintResult) {
    const secFindings = currentLintResult.securityReports.reduce((sum, r) => sum + r.findings.length, 0);
    vscode.window.showInformationMessage(
      `ClawdContext: ${currentBudget.allFiles.length} files. Security: ${secFindings} findings. Positional: ${currentLintResult.positionalWarnings} warnings.`
    );
  }
}

async function pruneLessons(): Promise<void> {
  if (!currentBudget) { await analyzeWorkspace(); }
  if (!currentBudget) { return; }
  const learningFiles = currentBudget.filesByLayer.get('learning') || [];
  if (learningFiles.length === 0) { vscode.window.showInformationMessage('No lessons.md found.'); return; }
  const config = vscode.workspace.getConfiguration('clawdcontext');
  const ttlDays = config.get<number>('lessonsTtlDays', 60);
  const now = new Date();
  for (const file of learningFiles) {
    const lines = file.content.split('\n');
    const stale: Array<{startLine:number;title:string;ageDays:number}> = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^## (\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)/);
      if (m) {
        const age = Math.floor((now.getTime() - new Date(m[1]).getTime()) / 86400000);
        const block = lines.slice(i, Math.min(i+10, lines.length)).join('\n');
        if (age > ttlDays && /type:\s*local-heuristic/i.test(block)) stale.push({startLine:i,title:m[2]||'Untitled',ageDays:age});
      }
    }
    if (stale.length === 0) { vscode.window.showInformationMessage('No stale entries. All clear!'); return; }
    const picks = await vscode.window.showQuickPick(stale.map(e => ({label:e.title,description:`${e.ageDays}d old`,detail:`Line ${e.startLine+1}`})),
      {canPickMany:true,title:`${stale.length} stale lessons`,placeHolder:'Select to deprecate'});
    if (picks && picks.length > 0) {
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(file.uri));
      vscode.window.showInformationMessage(`Selected ${picks.length}. Use the quick-fix lightbulb to mark deprecated.`);
    }
  }
}

async function promoteLessons(): Promise<void> {
  if (!currentBudget) { await analyzeWorkspace(); }
  if (!currentBudget) { return; }
  const learningFiles = currentBudget.filesByLayer.get('learning') || [];
  let total = 0;
  for (const f of learningFiles) total += f.metadata.promotionCandidates || 0;
  if (total === 0) { vscode.window.showInformationMessage('No promotion candidates.'); return; }
  vscode.window.showInformationMessage(`${total} promotion candidate(s). Review and promote validated lessons to CLAUDE.md.`);
  if (learningFiles.length > 0) await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(learningFiles[0].uri));
}

async function generateReport(): Promise<void> {
  if (!currentBudget) { await analyzeWorkspace(); }
  if (!currentBudget) { return; }
  const b = currentBudget; const lr = currentLintResult;
  const lines = [
    '# ClawdContext — Context Health Report','',`Generated: ${new Date().toISOString()}`,'',
    '## CER','',`| Metric | Value |`,`|--------|-------|`,
    `| CER | ${(b.cer*100).toFixed(1)}% (${b.cerStatus}) |`,
    `| Budget | ${b.totalBudget.toLocaleString()} |`,
    `| Always Loaded | ${b.alwaysLoadedTokens.toLocaleString()} |`,
    `| Headroom | ${b.reasoningHeadroom.toLocaleString()} |`,'',
  ];
  if (lr && lr.securityReports.length > 0) {
    lines.push('## Security','','| Skill | Score | Verdict |','|-------|-------|---------|');
    for (const r of lr.securityReports) lines.push(`| ${r.file.relativePath} | ${r.score}/100 | ${r.verdict} |`);
  }
  if (lr && lr.positionalWarnings > 0) lines.push('','## Positional',`${lr.positionalWarnings} critical instructions in dead zone.`);
  lines.push('','---','*ClawdContext v0.2.0*');
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({content:lines.join('\n'),language:'markdown'}));
}

function showDashboard(): void {
  if (!currentBudget) { vscode.window.showWarningMessage('Analyze workspace first.'); return; }
  const panel = vscode.window.createWebviewPanel('clawdcontextDashboard','ClawdContext Dashboard',vscode.ViewColumn.One,{enableScripts:true});
  panel.webview.html = getDashboardHtml(currentBudget, currentLintResult);
}

function getDashboardHtml(budget: ContextBudget, lintResult: LintResult | null): string {
  const cerPct = (budget.cer * 100).toFixed(1);
  const cerColor = budget.cerStatus === 'optimal' ? '#059669' : budget.cerStatus === 'warning' ? '#D97706' : '#DC2626';

  const secReports = lintResult?.securityReports || [];
  const secClean = secReports.filter(r => r.verdict === 'clean').length;
  const secSuspicious = secReports.filter(r => r.verdict === 'suspicious').length;
  const secDangerous = secReports.filter(r => r.verdict === 'dangerous').length;

  const securityRows = secReports.map(r => {
    const c = r.verdict === 'clean' ? '#059669' : r.verdict === 'suspicious' ? '#D97706' : '#DC2626';
    return `<tr><td>${r.file.relativePath}</td><td style="color:${c};font-weight:600">${r.score}/100</td><td style="color:${c}">${r.verdict.toUpperCase()}</td><td>${r.findings.length}</td></tr>`;
  }).join('\n');

  const positionalHtml = budget.allFiles
    .filter(f => f.alwaysLoaded && f.content.split('\n').length >= 6)
    .map(f => {
      const zones = analyzePositionalAttention(f.content);
      if (zones.length === 0) { return ''; }
      const middle = zones.find(z => z.zone === 'middle');
      const critical = middle?.criticalInstructions.length || 0;
      if (critical === 0) { return ''; }
      return `<div class="pos-file"><div class="pos-label">${f.relativePath}</div><div class="pos-bar"><div class="pos-zone pos-start" style="width:33%"><span>75%</span></div><div class="pos-zone pos-middle" style="width:34%"><span>55% ⚠️ ${critical}</span></div><div class="pos-zone pos-end" style="width:33%"><span>70%</span></div></div></div>`;
    }).filter(Boolean).join('\n');

  const layerLabels: Record<string,string> = {hook:'⛔ Hooks',kernel:'🧬 Kernel',skill:'📘 Skills',task:'📋 Tasks',learning:'🧠 Lessons',subagent:'🔬 Subagents'};
  const layerColors: Record<string,string> = {hook:'#DC2626',kernel:'#7C3AED',skill:'#2563EB',task:'#059669',learning:'#D97706',subagent:'#0891B2'};

  const layerData = (['hook','kernel','skill','task','learning','subagent'] as const)
    .map(key => {const files = budget.filesByLayer.get(key) || []; return {key,tokens:files.reduce((s,f)=>s+f.tokens,0),files:files.length};})
    .filter(d => d.files > 0);
  const maxTokens = Math.max(...layerData.map(d => d.tokens), 1);

  const layerBarsHtml = layerData.map(d => {
    const pct = ((d.tokens / maxTokens) * 100).toFixed(0);
    return `<div class="lbr"><div class="lbl">${layerLabels[d.key]||d.key}</div><div class="lbt"><div class="lbf" style="width:${pct}%;background:${layerColors[d.key]||'#666'}"></div></div><div class="lbv">${(d.tokens/1000).toFixed(1)}K</div></div>`;
  }).join('\n');

  return `<!DOCTYPE html><html><head><style>
:root{--bg:var(--vscode-editor-background);--fg:var(--vscode-editor-foreground);--border:var(--vscode-widget-border);--widget:var(--vscode-editorWidget-background);--muted:var(--vscode-descriptionForeground)}
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;background:var(--bg);color:var(--fg);max-width:900px;margin:0 auto}
h1{font-size:20px;margin-bottom:2px}h2{font-size:14px;margin-top:24px;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}
.sub{color:var(--muted);margin-bottom:20px;font-size:13px}
.card{background:var(--widget);border:1px solid var(--border);border-radius:8px;padding:18px;margin-bottom:14px}
.cerc{text-align:center}.cerv{font-size:56px;font-weight:800;color:${cerColor};line-height:1}.cerl{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);margin-bottom:4px}.cers{font-size:13px;font-weight:600;color:${cerColor};margin-top:4px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.metric{background:var(--widget);border:1px solid var(--border);border-radius:6px;padding:12px}
.mv{font-size:22px;font-weight:700}.ml{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:600px){.g2,.metrics{grid-template-columns:1fr}}
.lbr{display:flex;align-items:center;margin-bottom:5px}.lbl{width:105px;font-size:12px;flex-shrink:0}.lbt{flex:1;height:18px;background:var(--border);border-radius:3px;overflow:hidden}.lbf{height:100%;border-radius:3px}.lbv{width:50px;text-align:right;font-size:12px;font-weight:600;flex-shrink:0;margin-left:8px}
.whatif label{font-size:12px;color:var(--muted)}.wh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.wr{font-size:20px;font-weight:700;transition:color .2s}
input[type=range]{width:100%;margin:8px 0;accent-color:${cerColor}}.wl{display:flex;justify-content:space-between;font-size:10px;color:var(--muted)}
.sec-s{display:flex;gap:10px;margin-bottom:10px}.sb{padding:3px 9px;border-radius:12px;font-size:12px;font-weight:600}
.sc{background:#05966920;color:#059669}.ss{background:#D9770620;color:#D97706}.sd{background:#DC262620;color:#DC2626}
table{width:100%;border-collapse:collapse}th{text-align:left;padding:5px 8px;border-bottom:2px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}td{padding:5px 8px;border-bottom:1px solid var(--border);font-size:13px}
.pos-file{margin-bottom:8px}.pos-label{font-size:12px;margin-bottom:3px}.pos-bar{display:flex;height:26px;border-radius:4px;overflow:hidden;border:1px solid var(--border)}
.pos-zone{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600}
.pos-start{background:#05966940;color:#059669}.pos-middle{background:#DC262630;color:#DC2626}.pos-end{background:#2563EB30;color:#2563EB}
.quote{font-style:italic;color:var(--muted);border-left:3px solid ${cerColor};padding-left:12px;margin-top:20px;font-size:13px}
.footer{text-align:center;color:var(--muted);font-size:11px;margin-top:20px}
</style></head><body>
<h1>ClawdContext Dashboard</h1><p class="sub">Markdown OS — Context Health Monitor v0.2</p>

<div class="card cerc"><div class="cerl">Context Efficiency Ratio</div><div class="cerv">${cerPct}%</div><div class="cers">${budget.cerStatus.toUpperCase()}</div></div>

<div class="metrics">
<div class="metric"><div class="mv">${(budget.alwaysLoadedTokens/1000).toFixed(1)}K</div><div class="ml">Always Loaded</div></div>
<div class="metric"><div class="mv">${(budget.onDemandTokens/1000).toFixed(1)}K</div><div class="ml">On-Demand</div></div>
<div class="metric"><div class="mv">${(budget.reasoningHeadroom/1000).toFixed(1)}K</div><div class="ml">Headroom</div></div>
<div class="metric"><div class="mv">${budget.allFiles.length}</div><div class="ml">Agent Files</div></div>
</div>

<div class="g2">
<div class="card"><h2>Token Budget by Layer</h2>${layerBarsHtml}</div>
<div class="card whatif"><h2>What-If Simulator</h2>
<p style="font-size:12px;color:var(--muted);margin-bottom:10px">Simulate adding tokens to always-loaded context:</p>
<div class="wh"><label>Additional: <strong id="wt">0</strong></label><div class="wr" id="wc">${cerPct}%</div></div>
<input type="range" id="ws" min="0" max="${budget.totalBudget}" value="0" step="500"/>
<div class="wl"><span>+0</span><span>+${(budget.totalBudget/2000).toFixed(0)}K</span><span>+${(budget.totalBudget/1000).toFixed(0)}K</span></div>
<div id="wst" style="font-size:12px;margin-top:6px;color:var(--muted)"></div>
</div></div>

${secReports.length > 0 ? `<div class="card"><h2>🔒 Security Scan</h2>
<div class="sec-s">${secClean>0?`<span class="sb sc">✓ ${secClean} clean</span>`:''}${secSuspicious>0?`<span class="sb ss">⚠ ${secSuspicious} suspicious</span>`:''}${secDangerous>0?`<span class="sb sd">✕ ${secDangerous} dangerous</span>`:''}</div>
<table><thead><tr><th>Skill</th><th>Score</th><th>Verdict</th><th>Findings</th></tr></thead><tbody>${securityRows}</tbody></table></div>` : ''}

${positionalHtml ? `<div class="card"><h2>📍 Positional Attention Map</h2>
<p style="font-size:12px;color:var(--muted);margin-bottom:10px">Stanford Lost-in-the-Middle: attention by position. Critical instructions in red zone are at risk.</p>
${positionalHtml}</div>` : ''}

<p class="quote">"Treat context like OS memory: budget it, compact it, page it intelligently."</p>
<p class="footer">ClawdContext v0.2.0 — ${budget.allFiles.length} files · ${(budget.alwaysLoadedTokens+budget.onDemandTokens).toLocaleString()} total tokens</p>

<script>
const sl=document.getElementById('ws'),te=document.getElementById('wt'),ce=document.getElementById('wc'),se=document.getElementById('wst');
const tb=${budget.totalBudget},cl=${budget.alwaysLoadedTokens};
sl.addEventListener('input',()=>{const a=parseInt(sl.value),nl=cl+a,nc=Math.max(0,(tb-nl)/tb),np=(nc*100).toFixed(1);
te.textContent=a.toLocaleString();ce.textContent=np+'%';
let s,c;if(nc>.6){s='OPTIMAL';c='#059669'}else if(nc>.3){s='WARNING';c='#D97706'}else{s='CRITICAL — Heat death imminent';c='#DC2626'}
ce.style.color=c;se.innerHTML='<span style="color:'+c+';font-weight:600">'+s+'</span> — '+(nl/1000).toFixed(1)+'K / '+(tb/1000).toFixed(0)+'K loaded';});
</script></body></html>`;
}

export function deactivate() { console.log('ClawdContext deactivated'); }

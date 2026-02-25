/**
 * AI-powered commands for ClawdContext.
 *
 * All commands gracefully degrade when AI is not configured:
 * they show a message prompting the user to set up their provider.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { isAiEnabled, aiComplete, testAiConnection, getAiConfig, getProviderLabel } from './provider';
import { SYSTEM_PROMPT_ANALYST } from './prompts';
import * as validator from './aiValidator';
import * as generator from './aiGenerator';
import { state, analyzeWorkspace } from '../commands/analyzeWorkspace';
import { estimateTokens } from '../analyzers/tokenAnalyzer';
import type { AgentFile } from '../analyzers/tokenAnalyzer';
import type { Violation } from './aiValidator';

// ─── Guards ─────────────────────────────────────────────────────────

function requireAi(): boolean {
  if (!isAiEnabled()) {
    const config = getAiConfig();
    if (config.provider === 'none') {
      vscode.window.showInformationMessage(
        'AI is not configured. Set "clawdcontext.ai.provider" in settings to enable AI features.',
        'Open Settings',
      ).then(choice => {
        if (choice === 'Open Settings') {
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'clawdcontext.ai',
          );
        }
      });
    } else {
      vscode.window.showWarningMessage(
        `API key required for ${config.provider}. Set "clawdcontext.ai.apiKey" in settings.`,
        'Open Settings',
      ).then(choice => {
        if (choice === 'Open Settings') {
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'clawdcontext.ai.apiKey',
          );
        }
      });
    }
    return false;
  }
  return true;
}

function requireWorkspace(): boolean {
  if (!state.budget) {
    vscode.window.showWarningMessage(
      'Run "ClawdContext: Analyze Workspace" first.',
    );
    return false;
  }
  return true;
}

// System prompt is imported from ./prompts.ts (SYSTEM_PROMPT_ANALYST)

// ─── Commands ───────────────────────────────────────────────────────

/**
 * Test the AI connection and show the result.
 */
export async function aiTestConnection(): Promise<void> {
  if (!requireAi()) { return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Testing AI connection...' },
    async () => {
      try {
        const result = await testAiConnection();
        vscode.window.showInformationMessage(`✅ ${result}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`❌ AI connection failed: ${msg}`);
      }
    },
  );
}

/**
 * AI-powered review of the agent kernel config.
 * Sends CER metrics + CLAUDE.md content for optimisation suggestions.
 */
export async function aiReviewConfig(): Promise<void> {
  if (!requireAi() || !requireWorkspace()) { return; }

  const budget = state.budget!;

  // Read CLAUDE.md content if available
  let claudeMd = '';
  const kernelFiles = budget.filesByLayer.get('kernel') || [];
  const claudeFile = kernelFiles.find(f =>
    f.relativePath.toLowerCase().includes('claude.md'),
  );
  if (claudeFile) {
    claudeMd = claudeFile.content.substring(0, 8000); // Limit to avoid huge payloads
  }

  const cerPct = (budget.cer * 100).toFixed(1);
  const alwaysK = (budget.alwaysLoadedTokens / 1000).toFixed(1);
  const onDemandK = (budget.onDemandTokens / 1000).toFixed(1);
  const headroomK = (budget.reasoningHeadroom / 1000).toFixed(1);

  // Build layer summary
  const layerSummary = (['hook', 'kernel', 'skill', 'task', 'learning', 'subagent'] as const)
    .map(key => {
      const files = budget.filesByLayer.get(key) || [];
      const tokens = files.reduce((s, f) => s + f.tokens, 0);
      return files.length > 0 ? `  - ${key}: ${files.length} files, ${(tokens / 1000).toFixed(1)}K tokens` : '';
    })
    .filter(Boolean)
    .join('\n');

  // Security summary
  const secFindings = state.lintResult?.securityReports.reduce(
    (sum, r) => sum + r.findings.filter(f => !f.suppressed).length, 0,
  ) ?? 0;

  const prompt = `Review this AI agent's Markdown OS configuration and suggest improvements.

## Current Metrics
- CER: ${cerPct}% (${budget.cerStatus})
- Always-loaded: ${alwaysK}K tokens
- On-demand: ${onDemandK}K tokens
- Reasoning headroom: ${headroomK}K tokens
- Total budget: ${(budget.totalBudget / 1000).toFixed(0)}K tokens
- Files: ${budget.allFiles.length}
- Active security findings: ${secFindings}

## Layer Distribution
${layerSummary}

## CLAUDE.md Content (first 8000 chars)
\`\`\`markdown
${claudeMd || '(No CLAUDE.md found)'}
\`\`\`

## Please Provide
1. **CER assessment**: Is the ratio healthy? What's consuming too many tokens?
2. **Content audit**: Are there sections in CLAUDE.md that should be extracted to SKILL.md (lazy-loaded)?
3. **Positional risks**: Any critical instructions buried in the middle?
4. **Quick wins**: Top 3 actionable changes to improve context efficiency.`;

  await streamToDocument('ClawdContext AI: Config Review', prompt);
}

/**
 * AI-powered explanation of a specific diagnostic.
 * Uses the active editor's diagnostics for context.
 */
export async function aiExplainDiagnostic(): Promise<void> {
  if (!requireAi()) { return; }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Open a file with diagnostics first.');
    return;
  }

  // Get diagnostics for the current file
  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
    .filter(d => d.source === 'ClawdContext');

  if (diagnostics.length === 0) {
    vscode.window.showInformationMessage('No ClawdContext diagnostics in this file.');
    return;
  }

  // If multiple, let user pick
  let diagnostic: vscode.Diagnostic;
  if (diagnostics.length === 1) {
    diagnostic = diagnostics[0];
  } else {
    const items = diagnostics.map((d, i) => ({
      label: `Line ${d.range.start.line + 1}: ${d.message.substring(0, 80)}`,
      index: i,
    }));
    const pick = await vscode.window.showQuickPick(items, {
      title: 'Which diagnostic?',
      placeHolder: 'Select a diagnostic to explain',
    });
    if (!pick) { return; }
    diagnostic = diagnostics[pick.index];
  }

  // Get surrounding context
  const startLine = Math.max(0, diagnostic.range.start.line - 5);
  const endLine = Math.min(editor.document.lineCount - 1, diagnostic.range.end.line + 5);
  const context = editor.document.getText(
    new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length),
  );

  const prompt = `Explain this ClawdContext diagnostic and suggest how to fix it.

## Diagnostic
- **Message**: ${diagnostic.message}
- **Severity**: ${vscode.DiagnosticSeverity[diagnostic.severity]}
- **Location**: ${editor.document.fileName}:${diagnostic.range.start.line + 1}

## Surrounding Context (lines ${startLine + 1}-${endLine + 1})
\`\`\`markdown
${context}
\`\`\`

## Please Provide
1. **Why** this diagnostic fired — what rule or pattern triggered it
2. **Risk** — what could go wrong if ignored
3. **Fix** — concrete rewrite suggestion with the corrected markdown`;

  await streamToDocument('ClawdContext AI: Diagnostic Explanation', prompt);
}

/**
 * AI-powered suggestion for what to refactor from the kernel.
 * Identifies content that should move from always-loaded to on-demand.
 */
export async function aiSuggestRefactor(): Promise<void> {
  if (!requireAi() || !requireWorkspace()) { return; }

  const budget = state.budget!;

  // Gather always-loaded file info
  const alwaysFiles = budget.allFiles
    .filter(f => f.alwaysLoaded)
    .map(f => ({
      path: f.relativePath,
      tokens: f.tokens,
      headings: extractHeadings(f.content),
    }));

  if (alwaysFiles.length === 0) {
    vscode.window.showInformationMessage('No always-loaded files found.');
    return;
  }

  const fileList = alwaysFiles.map(f =>
    `### ${f.path} (${(f.tokens / 1000).toFixed(1)}K tokens)\nHeadings: ${f.headings.join(' → ') || '(none)'}`,
  ).join('\n\n');

  const prompt = `Analyze these always-loaded Markdown OS files and suggest what to extract into on-demand SKILL.md files.

## Current CER: ${(budget.cer * 100).toFixed(1)}% (${budget.cerStatus})
Always-loaded: ${(budget.alwaysLoadedTokens / 1000).toFixed(1)}K tokens
Budget: ${(budget.totalBudget / 1000).toFixed(0)}K tokens

## Always-Loaded Files
${fileList}

## Refactoring Criteria
- Sections > 500 tokens that are only needed for specific tasks → extract to SKILL.md
- Deployment/build instructions → move to a deploy skill
- Language-specific details → move to a language skill
- Historical context/lessons → move to lessons.md
- Keep: Core identity, critical rules, common commands (< 200 tokens)

## Please Provide
1. **Extraction candidates**: Which sections should move, where to, estimated token savings
2. **Priority order**: Which extraction gives the best CER improvement
3. **Risk assessment**: Any sections that MUST stay always-loaded (critical rules)
4. **Projected CER**: Expected CER after suggested refactoring`;

  await streamToDocument('ClawdContext AI: Refactor Suggestions', prompt);
}

/**
 * AI-powered security analysis of the currently open SKILL.md.
 * Goes beyond regex patterns to understand intent.
 */
export async function aiSecurityReview(): Promise<void> {
  if (!requireAi()) { return; }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Open a SKILL.md file first.');
    return;
  }

  const content = editor.document.getText();
  const fileName = path.basename(editor.document.fileName);

  // Check if it's a skill-like file
  if (!fileName.includes('SKILL') && !fileName.includes('skill') && !editor.document.fileName.includes('/skills/')) {
    const proceed = await vscode.window.showWarningMessage(
      'This doesn\'t appear to be a SKILL.md file. Analyze anyway?',
      'Yes', 'No',
    );
    if (proceed !== 'Yes') { return; }
  }

  // Truncate very large files
  const truncated = content.substring(0, 12000);

  const prompt = `Perform a security review of this SKILL.md file for an AI coding agent.

## File: ${editor.document.fileName}
\`\`\`markdown
${truncated}
\`\`\`
${content.length > 12000 ? `\n(Truncated from ${content.length} to 12000 chars)\n` : ''}

## Security Analysis Requested
Evaluate for these threat categories:
1. **Prompt injection**: Instructions that could override the agent's system prompt
2. **Credential exposure**: Secrets, API keys, tokens, passwords in plain text
3. **Data exfiltration**: URLs or commands that could leak data to external services
4. **Privilege escalation**: Commands that grant elevated permissions
5. **Persistence**: Instructions that modify system files or create backdoors
6. **Social engineering**: Instruction patterns that manipulate agent behavior subtly

## For Each Finding, Provide
- Severity (Critical / High / Medium / Low / Info)
- Line reference or quote
- Why it's a risk (or why it's a false positive if it's a documentation example)
- Recommended mitigation

## Also Provide
- Overall trust assessment (1-10 scale)
- Whether this file is safe to include in an agent's context without human review`;

  await streamToDocument('ClawdContext AI: Security Review', prompt);
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Extract markdown headings from content. */
function extractHeadings(content: string): string[] {
  return content
    .split('\n')
    .filter(line => /^#{1,4}\s/.test(line))
    .map(line => line.replace(/^#+\s*/, '').trim())
    .slice(0, 20);
}

/**
 * Send a prompt to the AI and display the result in a new untitled document.
 * Shows progress notification while waiting.
 */
async function streamToDocument(title: string, userPrompt: string): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `${title} — thinking...`,
      cancellable: false,
    },
    async () => {
      try {
        const result = await aiComplete({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_ANALYST },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          maxTokens: 3000,
        });

        const doc = await vscode.workspace.openTextDocument({
          content: `# ${title}\n\n${result.content}\n\n---\n_Model: ${result.model}${result.tokensUsed ? ` · ${result.tokensUsed} tokens` : ''}${result.latencyMs ? ` · ${result.latencyMs}ms` : ''}_\n`,
          language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`AI request failed: ${msg}`);
      }
    },
  );
}

// ─── AI Validate Workspace ──────────────────────────────────────────

export async function aiValidateWorkspace(): Promise<void> {
  if (!requireAi()) { return; }
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const results = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'AI validating agent files...', cancellable: false },
    async (progress) => validator.validateWorkspace(state.budget!, progress),
  );

  const lines = ['# AI Validation Report (mdcc)', '',
    `Provider: ${getProviderLabel(getAiConfig().provider)} | Files: ${results.length}`, ''];

  for (const r of results) {
    const gate = validator.computeQualityGate(r.score);
    const icon = gate.gate === 'PRODUCTION' ? '✅' : gate.gate === 'MANUAL_REVIEW' ? '⚠️' : '❌';
    lines.push(`## ${icon} ${r.file} — ${r.score}/100 (${r.verdict})`);
    lines.push(`Quality Gate: **${gate.gate}** | Latency: ${r.latencyMs}ms`, '');

    if (r.violations.length > 0) {
      lines.push('| Rule | Severity | Message | Fix |', '|------|----------|---------|-----|');
      for (const v of r.violations) {
        lines.push(`| ${v.rule} | ${v.severity} | ${v.message} | ${v.fix} |`);
      }
      lines.push('');
    }
    if (r.suggestions.length > 0) {
      lines.push('**Suggestions:**');
      for (const s of r.suggestions) { lines.push(`- ${s}`); }
      lines.push('');
    }
  }

  const doc = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'markdown' });
  await vscode.window.showTextDocument(doc);
}

// ─── AI Validate Current File ───────────────────────────────────────

export async function aiValidateFile(): Promise<void> {
  if (!requireAi()) { return; }

  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document.fileName.endsWith('.md')) {
    vscode.window.showWarningMessage('Open a .md agent file to validate.');
    return;
  }
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const file = state.budget.allFiles.find(f => editor.document.uri.toString() === f.uri.toString());
  if (!file) { vscode.window.showWarningMessage('This file is not recognized as an agent file.'); return; }

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `AI validating ${file.relativePath}...` },
    async () => validator.validateFile(file),
  );

  const gate = validator.computeQualityGate(result.score);
  const icon = gate.gate === 'PRODUCTION' ? '✅' : gate.gate === 'MANUAL_REVIEW' ? '⚠️' : '❌';

  const action = await vscode.window.showInformationMessage(
    `${icon} ${file.relativePath}: ${result.score}/100 (${gate.gate}). ${result.violations.length} violation(s).`,
    ...(result.violations.length > 0 ? ['AI Fix', 'Show Details'] : ['Show Details']),
  );

  if (action === 'AI Fix') {
    await aiFixWithViolations(file, result.violations);
  } else if (action === 'Show Details') {
    const detail = result.violations.length > 0
      ? result.violations.map(v => `[${v.severity}] ${v.rule}: ${v.message}`).join('\n')
      : 'No violations found.';
    const doc = await vscode.workspace.openTextDocument({
      content: `# ${file.relativePath}\nScore: ${result.score}/100\nGate: ${gate.gate}\n\n${detail}`,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  }
}

// ─── AI Generate Missing Files ──────────────────────────────────────

export async function aiGenerateMissing(): Promise<void> {
  if (!requireAi()) { return; }
  if (!state.budget) { await analyzeWorkspace(); }

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'AI generating missing agent files...' },
    async (progress) => generator.generateMissing(state.budget, progress),
  );

  if (result.files.length === 0) {
    vscode.window.showInformationMessage('All essential agent files already exist.');
    return;
  }

  for (const f of result.files) {
    const action = await vscode.window.showInformationMessage(
      `Generated ${f.path} (${f.tokens} tokens). Save?`,
      'Save', 'Preview', 'Skip',
    );
    if (action === 'Save' || action === 'Preview') {
      if (action === 'Preview') {
        const doc = await vscode.workspace.openTextDocument({ content: f.content, language: 'markdown' });
        await vscode.window.showTextDocument(doc);
        const confirm = await vscode.window.showInformationMessage(`Save ${f.path}?`, 'Save', 'Discard');
        if (confirm !== 'Save') { continue; }
      }
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (ws) {
        const uri = vscode.Uri.joinPath(ws.uri, f.path);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(f.content, 'utf8'));
        vscode.window.showInformationMessage(`Saved ${f.path}`);
      }
    }
  }
  await analyzeWorkspace();
}

// ─── AI Generate Specific File ──────────────────────────────────────

export async function aiGenerateFile(): Promise<void> {
  if (!requireAi()) { return; }

  const target = await vscode.window.showQuickPick(
    ['CLAUDE.md', 'SKILL.md', 'todo.md', 'lessons.md', 'AGENTS.md'],
    { title: 'Which file to generate?', placeHolder: 'Select target file' },
  );
  if (!target) { return; }

  const instructions = await vscode.window.showInputBox({
    prompt: `Custom instructions for ${target} generation (optional)`,
    placeHolder: 'e.g., This is a Python FastAPI project with PostgreSQL...',
  });

  if (!state.budget) { await analyzeWorkspace(); }

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `AI generating ${target}...` },
    async () => generator.generateFile(target as generator.GenerateTarget, state.budget, instructions || undefined),
  );

  for (const f of result.files) {
    const doc = await vscode.workspace.openTextDocument({ content: f.content, language: 'markdown' });
    await vscode.window.showTextDocument(doc);

    const action = await vscode.window.showInformationMessage(
      `Generated ${f.path} (${f.tokens} tokens, ${result.latencyMs}ms). Save?`,
      'Save', 'Discard',
    );
    if (action === 'Save') {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (ws) {
        const uri = vscode.Uri.joinPath(ws.uri, f.path);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(f.content, 'utf8'));
        vscode.window.showInformationMessage(`Saved ${f.path}`);
      }
    }
  }
  await analyzeWorkspace();
}

// ─── AI Fix Current File ────────────────────────────────────────────

export async function aiFixCurrentFile(): Promise<void> {
  if (!requireAi()) { return; }

  const editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showWarningMessage('Open a file to fix.'); return; }
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const file = state.budget.allFiles.find(f => editor.document.uri.toString() === f.uri.toString());
  if (!file) { vscode.window.showWarningMessage('Not an agent file.'); return; }

  // First validate to get violations
  const validation = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Validating ${file.relativePath}...` },
    async () => validator.validateFile(file),
  );

  if (validation.violations.length === 0) {
    vscode.window.showInformationMessage(`${file.relativePath}: No violations found (score: ${validation.score}/100).`);
    return;
  }

  await aiFixWithViolations(file, validation.violations);
}

// ─── AI Detect Contradictions ───────────────────────────────────────

export async function aiDetectContradictions(): Promise<void> {
  if (!requireAi()) { return; }
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const results = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'AI detecting semantic contradictions...', cancellable: false },
    async (progress) => validator.detectContradictions(state.budget!, progress),
  );

  if (results.length === 0) {
    vscode.window.showInformationMessage('✅ No semantic contradictions detected (Three-Body Problem: clear).');
    return;
  }

  const lines = ['# Three-Body Problem — Semantic Contradictions', '',
    `Found ${results.length} contradiction(s) between kernel and learning layers.`, ''];

  for (const c of results) {
    lines.push(`## ${c.subject} (confidence: ${(c.confidence * 100).toFixed(0)}%)`);
    lines.push(`- **File A**: ${c.fileA}:${c.lineA + 1}`);
    lines.push(`- **File B**: ${c.fileB}:${c.lineB + 1}`);
    lines.push(`- **Explanation**: ${c.explanation}`);
    lines.push(`- **Resolution**: ${c.resolution}`, '');
  }

  const doc = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'markdown' });
  await vscode.window.showTextDocument(doc);
}

// ─── Internal: Fix with Violations ──────────────────────────────────

async function aiFixWithViolations(file: AgentFile, violations: Violation[]): Promise<void> {
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `AI fixing ${file.relativePath} (${violations.length} violations)...` },
    async () => generator.fixFileFromViolations(file, violations),
  );

  for (const f of result.files) {
    const doc = await vscode.workspace.openTextDocument({ content: f.content, language: 'markdown' });
    await vscode.window.showTextDocument(doc, f.isNew ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active);

    if (!f.isNew) {
      const action = await vscode.window.showInformationMessage(
        `Fixed ${f.path}. Apply changes?`, 'Apply', 'Keep Original',
      );
      if (action === 'Apply') {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) {
          const uri = vscode.Uri.joinPath(ws.uri, f.path);
          await vscode.workspace.fs.writeFile(uri, Buffer.from(f.content, 'utf8'));
          vscode.window.showInformationMessage(`Applied fix to ${f.path}`);
        }
      }
    } else {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (ws) {
        const uri = vscode.Uri.joinPath(ws.uri, f.path);
        try { await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(ws.uri, ...f.path.split('/').slice(0, -1))); } catch {}
        await vscode.workspace.fs.writeFile(uri, Buffer.from(f.content, 'utf8'));
        vscode.window.showInformationMessage(`Created ${f.path}`);
      }
    }
  }
  await analyzeWorkspace();
}

/**
 * CER Diff Tracking — compare context efficiency between git commits.
 *
 * Uses `git show HEAD~1:<path>` to retrieve previous versions of agent files,
 * then compares token counts and CER to pinpoint what changed.
 * Works entirely with Node.js child_process (no git SDK dependency).
 */

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { estimateTokens, classifyFile, calculateBudget } from '../analyzers/tokenAnalyzer';
import type { AgentFile, ContextBudget } from '../analyzers/tokenAnalyzer';
import { state, analyzeWorkspace } from './analyzeWorkspace';

// ─── Types ──────────────────────────────────────────────────────────

export interface CerDiff {
  timestamp: string;
  currentCer: number;
  previousCer: number;
  cerDelta: number;              // positive = improved
  currentTokens: number;
  previousTokens: number;
  tokenDelta: number;
  fileChanges: FileDiff[];
  commitRef: string;
}

export interface FileDiff {
  relativePath: string;
  layer: string;
  currentTokens: number;
  previousTokens: number;
  tokenDelta: number;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
}

// ─── Git Helpers ────────────────────────────────────────────────────

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Check if the workspace is a git repository.
 */
function isGitRepo(cwd: string): boolean {
  try {
    child_process.execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a file's content at a specific git ref (e.g. HEAD~1).
 * Returns null if the file didn't exist at that ref.
 */
function getFileAtRef(cwd: string, ref: string, relPath: string): string | null {
  try {
    return child_process.execFileSync('git', ['show', `${ref}:${relPath}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024, // 1MB
    });
  } catch {
    return null; // File didn't exist at that ref
  }
}

/**
 * Get the short commit hash for a ref.
 */
function getCommitHash(cwd: string, ref: string): string {
  try {
    return child_process.execFileSync('git', ['rev-parse', '--short', ref], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return ref;
  }
}

/**
 * List all agent .md files tracked by git.
 * Uses the current scan results + git to find files that existed in previous commits.
 */
function listAgentFilesInRef(cwd: string, ref: string): string[] {
  try {
    const output = child_process.execFileSync(
      'git', ['ls-tree', '-r', '--name-only', ref],
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 },
    );
    const agentPatterns = [
      /CLAUDE\.md$/i, /AGENTS\.md$/i, /SKILL\.md$/i,
      /lessons\.md$/i, /todo\.md$/i, /plan\.md$/i,
      /\.claude\/.*\.md$/i, /skills\/.*\.md$/i,
    ];
    return output.split('\n')
      .filter(f => agentPatterns.some(p => p.test(f)));
  } catch {
    return [];
  }
}

// ─── CER Diff Calculator ───────────────────────────────────────────

/**
 * Build a ContextBudget from file contents at a specific git ref.
 */
function buildBudgetAtRef(cwd: string, ref: string, filePaths: string[]): ContextBudget {
  const files: AgentFile[] = [];

  for (const relPath of filePaths) {
    const content = getFileAtRef(cwd, ref, relPath);
    if (content === null) { continue; }

    const { layer, alwaysLoaded } = classifyFile(relPath);
    const tokens = estimateTokens(content);

    files.push({
      uri: vscode.Uri.file(path.join(cwd, relPath)),
      relativePath: relPath,
      layer,
      tokens,
      content,
      alwaysLoaded,
      metadata: {},
    });
  }

  return calculateBudget(files);
}

/**
 * Compare CER between current workspace and a git ref.
 */
export function computeCerDiff(ref: string = 'HEAD~1'): CerDiff | null {
  const cwd = getWorkspaceRoot();
  if (!cwd || !isGitRepo(cwd)) { return null; }
  if (!state.budget) { return null; }

  const currentBudget = state.budget;

  // Get all agent files from both current and previous
  const prevFiles = listAgentFilesInRef(cwd, ref);
  const currentPaths = currentBudget.allFiles.map(f => f.relativePath);
  const allPaths = [...new Set([...prevFiles, ...currentPaths])];

  // Build previous budget
  const previousBudget = buildBudgetAtRef(cwd, ref, prevFiles);

  // Compare individual files
  const fileChanges: FileDiff[] = [];
  const prevMap = new Map(previousBudget.allFiles.map(f => [f.relativePath, f]));
  const currMap = new Map(currentBudget.allFiles.map(f => [f.relativePath, f]));

  for (const p of allPaths) {
    const prev = prevMap.get(p);
    const curr = currMap.get(p);

    if (curr && !prev) {
      fileChanges.push({
        relativePath: p,
        layer: curr.layer,
        currentTokens: curr.tokens,
        previousTokens: 0,
        tokenDelta: curr.tokens,
        status: 'added',
      });
    } else if (!curr && prev) {
      fileChanges.push({
        relativePath: p,
        layer: prev.layer,
        currentTokens: 0,
        previousTokens: prev.tokens,
        tokenDelta: -prev.tokens,
        status: 'removed',
      });
    } else if (curr && prev) {
      const delta = curr.tokens - prev.tokens;
      fileChanges.push({
        relativePath: p,
        layer: curr.layer,
        currentTokens: curr.tokens,
        previousTokens: prev.tokens,
        tokenDelta: delta,
        status: delta === 0 ? 'unchanged' : 'modified',
      });
    }
  }

  // Sort by absolute delta (biggest changes first)
  fileChanges.sort((a, b) => Math.abs(b.tokenDelta) - Math.abs(a.tokenDelta));

  const commitHash = getCommitHash(cwd, ref);

  return {
    timestamp: new Date().toISOString(),
    currentCer: currentBudget.cer,
    previousCer: previousBudget.cer,
    cerDelta: currentBudget.cer - previousBudget.cer,
    currentTokens: currentBudget.alwaysLoadedTokens,
    previousTokens: previousBudget.alwaysLoadedTokens,
    tokenDelta: currentBudget.alwaysLoadedTokens - previousBudget.alwaysLoadedTokens,
    fileChanges: fileChanges.filter(f => f.status !== 'unchanged'),
    commitRef: commitHash,
  };
}

// ─── Command ────────────────────────────────────────────────────────

/**
 * Show CER diff between current workspace and a previous commit.
 * The user can pick which ref to compare against.
 */
export async function cerDiffCommand(): Promise<void> {
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const cwd = getWorkspaceRoot();
  if (!cwd || !isGitRepo(cwd)) {
    vscode.window.showWarningMessage('CER diff requires a git repository.');
    return;
  }

  // Build quick-pick items from recent commits
  let commits: { hash: string; message: string }[] = [];
  try {
    const output = child_process.execFileSync(
      'git', ['log', '--oneline', '-10', '--format=%h|%s'],
      { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    commits = output.trim().split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, ...rest] = line.split('|');
        return { hash: hash.trim(), message: rest.join('|').trim() };
      });
  } catch {
    commits = [{ hash: 'HEAD~1', message: 'Previous commit' }];
  }

  if (commits.length === 0) {
    vscode.window.showWarningMessage('No git history found to compare against.');
    return;
  }

  const pick = await vscode.window.showQuickPick(
    commits.map(c => ({
      label: c.hash,
      description: c.message,
      detail: `Compare current CER against this commit`,
    })),
    { title: 'Compare CER with which commit?', placeHolder: 'Select a commit' },
  );

  if (!pick) { return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Computing CER diff...' },
    async () => {
      const diff = computeCerDiff(pick.label);
      if (!diff) {
        vscode.window.showErrorMessage('Failed to compute CER diff.');
        return;
      }
      await showCerDiffReport(diff, pick.label, pick.description || '');
    },
  );
}

async function showCerDiffReport(diff: CerDiff, ref: string, commitMsg: string): Promise<void> {
  const cerArrow = diff.cerDelta > 0 ? '📈 IMPROVED' : diff.cerDelta < 0 ? '📉 DEGRADED' : '➡️ UNCHANGED';
  const cerSign = diff.cerDelta >= 0 ? '+' : '';
  const tokSign = diff.tokenDelta >= 0 ? '+' : '';

  const lines = [
    '# CER Diff Report',
    '',
    `Comparing workspace → commit \`${ref}\` (${commitMsg})`,
    '',
    '## Summary',
    '',
    `| Metric | Previous | Current | Delta |`,
    `|--------|----------|---------|-------|`,
    `| CER | ${(diff.previousCer * 100).toFixed(1)}% | ${(diff.currentCer * 100).toFixed(1)}% | ${cerSign}${(diff.cerDelta * 100).toFixed(1)}% ${cerArrow} |`,
    `| Always-Loaded | ${diff.previousTokens.toLocaleString()} | ${diff.currentTokens.toLocaleString()} | ${tokSign}${diff.tokenDelta.toLocaleString()} tokens |`,
    '',
  ];

  if (diff.fileChanges.length > 0) {
    lines.push(
      '## File Changes',
      '',
      '| File | Status | Previous | Current | Δ Tokens |',
      '|------|--------|----------|---------|----------|',
    );

    for (const fc of diff.fileChanges) {
      const emoji = fc.status === 'added' ? '🆕' : fc.status === 'removed' ? '🗑️' : '📝';
      const delta = fc.tokenDelta >= 0 ? `+${fc.tokenDelta}` : `${fc.tokenDelta}`;
      lines.push(
        `| ${fc.relativePath} | ${emoji} ${fc.status} | ${fc.previousTokens.toLocaleString()} | ${fc.currentTokens.toLocaleString()} | ${delta} |`,
      );
    }
  } else {
    lines.push('_No agent file changes detected between these commits._');
  }

  // Actionable advice
  lines.push('', '## Recommendations', '');
  if (diff.cerDelta < -0.05) {
    lines.push(
      '⚠️ CER dropped significantly. Consider:',
      '- Moving newly added always-loaded content to on-demand SKILL.md files',
      '- Pruning stale lessons entries',
      '- Extracting verbose sections into lazy-loaded skills',
    );
  } else if (diff.cerDelta > 0.05) {
    lines.push('✅ Great work! CER improved — context efficiency is heading in the right direction.');
  } else {
    lines.push('ℹ️ CER is stable. No action needed.');
  }

  lines.push('', '---', `_Generated: ${diff.timestamp}_`);

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join('\n'),
    language: 'markdown',
  });
  await vscode.window.showTextDocument(doc, { preview: false });
}

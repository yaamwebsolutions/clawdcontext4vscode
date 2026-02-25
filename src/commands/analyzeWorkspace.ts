import * as vscode from 'vscode';
import type { ContextBudget } from '../analyzers/tokenAnalyzer';
import { scanWorkspace, calculateBudget } from '../analyzers/tokenAnalyzer';
import type { LintResult } from '../analyzers/diagnosticsProvider';
import { lintAllFiles } from '../analyzers/diagnosticsProvider';
import type { LayersTreeProvider, HealthTreeProvider, LessonsTreeProvider } from '../providers/treeProvider';
import type { LessonsCodeLensProvider } from '../providers/codeLensProvider';
import type { StatusBarManager } from '../providers/statusBar';

/**
 * Shared workspace state — singleton accessed by all commands.
 * Encapsulates the analysis result so extension.ts stays thin.
 */
export interface WorkspaceState {
  budget: ContextBudget | null;
  lintResult: LintResult | null;
}

export const state: WorkspaceState = {
  budget: null,
  lintResult: null,
};

/** Dependencies injected once from activate(). */
export interface WorkspaceDeps {
  diagnosticCollection: vscode.DiagnosticCollection;
  layersTree: LayersTreeProvider;
  healthTree: HealthTreeProvider;
  lessonsTree: LessonsTreeProvider;
  codeLensProvider: LessonsCodeLensProvider;
  statusBar: StatusBarManager;
}

let deps: WorkspaceDeps | null = null;

/** Call once from activate() to wire dependencies. */
export function initWorkspaceDeps(d: WorkspaceDeps): void {
  deps = d;
}

/**
 * Full workspace analysis pipeline:
 * scan → budget → refresh UI → lint.
 */
export async function analyzeWorkspace(): Promise<void> {
  if (!deps) { return; }
  const files = await scanWorkspace();
  state.budget = calculateBudget(files);
  deps.layersTree.refresh(state.budget);
  deps.healthTree.refresh(state.budget);
  deps.lessonsTree.refresh(state.budget);
  deps.statusBar.update(state.budget);
  deps.codeLensProvider.refresh();
  state.lintResult = lintAllFiles(state.budget, deps.diagnosticCollection);
}

/**
 * Lint command — runs analysis then shows a summary message.
 */
export async function lintMdFiles(): Promise<void> {
  await analyzeWorkspace();
  if (state.budget && state.lintResult) {
    const secFindings = state.lintResult.securityReports.reduce(
      (sum, r) => sum + r.findings.length, 0,
    );
    vscode.window.showInformationMessage(
      `ClawdContext: ${state.budget.allFiles.length} files. ` +
      `Security: ${secFindings} findings. ` +
      `Positional: ${state.lintResult.positionalWarnings} warnings.`,
    );
  }
}

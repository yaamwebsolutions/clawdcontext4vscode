import * as vscode from 'vscode';
import type { ContextBudget } from '../analyzers/tokenAnalyzer';

export class StatusBarManager {
  private cerItem: vscode.StatusBarItem;
  private budgetItem: vscode.StatusBarItem;

  constructor() {
    this.cerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.cerItem.command = 'clawdcontext.showDashboard';
    this.cerItem.tooltip = 'ClawdContext: Context Efficiency Ratio — Click to open dashboard';

    this.budgetItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.budgetItem.command = 'clawdcontext.analyzeWorkspace';
    this.budgetItem.tooltip = 'ClawdContext: Token budget — Click to re-analyze';
  }

  update(budget: ContextBudget): void {
    const config = vscode.workspace.getConfiguration('clawdcontext');
    if (!config.get<boolean>('enableStatusBar', true)) {
      this.hide();
      return;
    }

    // CER display
    const cerPct = (budget.cer * 100).toFixed(0);
    let cerIcon: string;
    let cerBg: string | undefined;

    switch (budget.cerStatus) {
      case 'optimal':
        cerIcon = '$(pass)';
        cerBg = undefined;
        break;
      case 'warning':
        cerIcon = '$(warning)';
        cerBg = 'statusBarItem.warningBackground';
        break;
      case 'critical':
        cerIcon = '$(error)';
        cerBg = 'statusBarItem.errorBackground';
        break;
    }

    this.cerItem.text = `${cerIcon} CER ${cerPct}%`;
    this.cerItem.backgroundColor = cerBg ? new vscode.ThemeColor(cerBg) : undefined;
    this.cerItem.show();

    // Budget display
    const loaded = budget.alwaysLoadedTokens;
    const total = budget.totalBudget;
    this.budgetItem.text = `$(symbol-ruler) ${(loaded / 1000).toFixed(1)}K / ${(total / 1000).toFixed(0)}K tok`;
    this.budgetItem.show();
  }

  hide(): void {
    this.cerItem.hide();
    this.budgetItem.hide();
  }

  dispose(): void {
    this.cerItem.dispose();
    this.budgetItem.dispose();
  }
}

import * as vscode from 'vscode';
import { createDiagnosticCollection } from './analyzers/diagnosticsProvider';
import {
  LayersTreeProvider,
  HealthTreeProvider,
  LessonsTreeProvider,
} from './providers/treeProvider';
import { LessonsCodeLensProvider } from './providers/codeLensProvider';
import { StatusBarManager } from './providers/statusBar';
import {
  ClawdContextCodeActionProvider,
  extractProcedureCommand,
  moveToLessonsCommand,
  archiveDeprecatedCommand,
  analyzeBloatCommand,
} from './providers/codeActionProvider';
import { scaffoldMarkdownOS } from './utils/scaffold';
import {
  initWorkspaceDeps,
  analyzeWorkspace,
  lintMdFiles,
} from './commands/analyzeWorkspace';
import { pruneLessons, promoteLessons } from './commands/lessonsCommands';
import { generateReport } from './commands/generateReport';
import { showDashboard } from './commands/showDashboard';
import { cerDiffCommand } from './commands/cerDiffTracking';
import { applyConfigPreset } from './commands/configPresets';
import { exportDashboard } from './commands/dashboardExport';
import {
  aiTestConnection,
  aiReviewConfig,
  aiExplainDiagnostic,
  aiSuggestRefactor,
  aiSecurityReview,
} from './ai';

export function activate(context: vscode.ExtensionContext): void {
  console.log('ClawdContext activated');

  // --- Infrastructure ---
  const diagnosticCollection = createDiagnosticCollection();
  context.subscriptions.push(diagnosticCollection);

  // --- Tree views ---
  const layersTree = new LayersTreeProvider();
  const healthTree = new HealthTreeProvider();
  const lessonsTree = new LessonsTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('clawdcontext.layers', layersTree),
    vscode.window.registerTreeDataProvider('clawdcontext.health', healthTree),
    vscode.window.registerTreeDataProvider('clawdcontext.lessons', lessonsTree),
  );

  // --- CodeLens ---
  const codeLensProvider = new LessonsCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { pattern: '**/lessons*.md' },
      codeLensProvider,
    ),
  );

  // --- Code actions ---
  const codeActionProvider = new ClawdContextCodeActionProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { pattern: '**/*.md' },
      codeActionProvider,
      { providedCodeActionKinds: ClawdContextCodeActionProvider.providedCodeActionKinds },
    ),
  );

  // --- Status bar ---
  const statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // --- Wire shared state so commands can access UI providers ---
  initWorkspaceDeps({
    diagnosticCollection,
    layersTree,
    healthTree,
    lessonsTree,
    codeLensProvider,
    statusBar,
  });

  // --- Register commands ---
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
    // --- v0.4.0 commands ---
    vscode.commands.registerCommand('clawdcontext.cerDiff', cerDiffCommand),
    vscode.commands.registerCommand('clawdcontext.applyPreset', applyConfigPreset),
    vscode.commands.registerCommand('clawdcontext.exportDashboard', exportDashboard),
    // --- AI commands (optional — gracefully degrade when not configured) ---
    vscode.commands.registerCommand('clawdcontext.aiTestConnection', aiTestConnection),
    vscode.commands.registerCommand('clawdcontext.aiReviewConfig', aiReviewConfig),
    vscode.commands.registerCommand('clawdcontext.aiExplainDiagnostic', aiExplainDiagnostic),
    vscode.commands.registerCommand('clawdcontext.aiSuggestRefactor', aiSuggestRefactor),
    vscode.commands.registerCommand('clawdcontext.aiSecurityReview', aiSecurityReview),
  );

  // --- File watcher ---
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/{CLAUDE,AGENTS,SKILL,lessons,todo,plan}.md',
  );
  watcher.onDidChange(() => analyzeWorkspace());
  watcher.onDidCreate(() => analyzeWorkspace());
  watcher.onDidDelete(() => analyzeWorkspace());
  context.subscriptions.push(watcher);

  // --- Initial scan ---
  analyzeWorkspace();
}

export function deactivate(): void {
  console.log('ClawdContext deactivated');
}

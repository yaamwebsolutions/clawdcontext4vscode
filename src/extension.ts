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
  aiValidateWorkspace,
  aiValidateFile,
  aiGenerateMissing,
  aiGenerateFile,
  aiFixCurrentFile,
  aiDetectContradictions,
  isAiEnabled,
} from './ai';
import { initializeOSWorkspace, showOSStatus } from './commands/osWorkspace';
import { SfsClient, SfsServerManager, openSkillForgePanel } from './skillForge';

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

  // --- Skill Forge infrastructure ---
  const sfsConfig = vscode.workspace.getConfiguration('clawdcontext.skillForge');
  const sfsClient = new SfsClient(
    sfsConfig.get<string>('serverUrl', 'http://localhost:8742'),
    sfsConfig.get<string>('apiKey', ''),
  );
  const sfsServerManager = new SfsServerManager(sfsClient);
  const sfsDeps = { client: sfsClient, serverManager: sfsServerManager };
  context.subscriptions.push(sfsServerManager);

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
    // --- AI v2 commands (eurka/future integration) ---
    vscode.commands.registerCommand('clawdcontext.aiValidate', aiValidateWorkspace),
    vscode.commands.registerCommand('clawdcontext.aiValidateFile', aiValidateFile),
    vscode.commands.registerCommand('clawdcontext.aiGenerate', aiGenerateMissing),
    vscode.commands.registerCommand('clawdcontext.aiGenerateFile', aiGenerateFile),
    vscode.commands.registerCommand('clawdcontext.aiFix', aiFixCurrentFile),
    vscode.commands.registerCommand('clawdcontext.aiContradictions', aiDetectContradictions),
    // --- OS Workspace commands ---
    vscode.commands.registerCommand('clawdcontext.initOS', initializeOSWorkspace),
    vscode.commands.registerCommand('clawdcontext.osStatus', showOSStatus),
    // --- Skill Forge ---
    vscode.commands.registerCommand('clawdcontext.skillForge', () => openSkillForgePanel(sfsDeps)),
    vscode.commands.registerCommand('clawdcontext.skillForgeToggleServer', () => {
      if (sfsServerManager.status === 'running') { sfsServerManager.stop(); }
      else { sfsServerManager.start(); }
    }),
  );

  // Auto-start SFS backend if configured
  if (sfsConfig.get<boolean>('autoStart', false)) {
    sfsServerManager.start();
  }

  // --- Set context key for AI-aware menus ---
  vscode.commands.executeCommand('setContext', 'clawdcontext:aiEnabled', isAiEnabled());
  // Re-evaluate when settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('clawdcontext.ai')) {
        vscode.commands.executeCommand('setContext', 'clawdcontext:aiEnabled', isAiEnabled());
      }
    }),
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

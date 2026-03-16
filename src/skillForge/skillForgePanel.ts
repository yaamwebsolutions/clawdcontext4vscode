/**
 * Skill Forge Studio — Webview Panel.
 *
 * Creates the VS Code webview panel and implements the message bridge
 * between the vanilla HTML wizard and the extension backend.
 *
 * Message flow:
 *   Webview  ─postMessage→  SkillForgePanel.handleMessage()
 *                              │
 *                    ┌─────────┴─────────┐
 *                    │  SFS online?       │
 *                    │  ├ yes → SfsClient │
 *                    │  └ no  → templates │
 *                    └─────────┬─────────┘
 *                              │
 *   Webview  ←postMessage─   result
 */

import * as vscode from 'vscode';
import type { SfsClient, SfsSkillConfig, SfsGeneratedFile } from './sfsClient';
import type { SfsServerManager } from './serverManager';
import { getAiBridgeStatus, buildBridgeConfig } from './aiBridge';
import { getAiConfig, isAiEnabled } from '../ai/provider';
import { getSkillForgeWebviewHtml } from './webviewHtml';
import { generateOfflineSkill } from './templates';

// Reuse a single panel instance
let currentPanel: vscode.WebviewPanel | undefined;

export interface SkillForgePanelDeps {
  client: SfsClient;
  serverManager: SfsServerManager;
}

/**
 * Open (or focus) the Skill Forge Studio webview panel.
 */
export async function openSkillForgePanel(deps: SkillForgePanelDeps): Promise<void> {
  const { client } = deps;

  // If panel exists, reveal it
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  // Determine mode
  const online = await client.isAvailable();

  // Create panel
  currentPanel = vscode.window.createWebviewPanel(
    'clawdcontextSkillForge',
    'Skill Forge Studio',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  currentPanel.webview.html = getSkillForgeWebviewHtml(online ? 'online' : 'offline');

  // Cleanup on close
  currentPanel.onDidDispose(() => { currentPanel = undefined; });

  // Send initial state
  const aiStatus = await getAiBridgeStatus(client);
  currentPanel.webview.postMessage({
    command: 'mode',
    online,
    ai: aiStatus,
  });

  // ─── Message handler ────────────────────────────────────
  currentPanel.webview.onDidReceiveMessage(async (msg) => {
    await handleMessage(msg, deps);
  });
}

// ─── Message Router ───────────────────────────────────────────

async function handleMessage(
  msg: Record<string, unknown>,
  deps: SkillForgePanelDeps,
): Promise<void> {
  const { client } = deps;
  const panel = currentPanel;
  if (!panel) { return; }

  const post = (data: Record<string, unknown>) => panel.webview.postMessage(data);

  switch (msg.command) {
    // ─── Status check ───────────────────────────────────
    case 'sfs:check': {
      const online = await client.isAvailable();
      const aiStatus = await getAiBridgeStatus(client);
      post({ command: 'mode', online, ai: aiStatus });
      break;
    }

    // ─── Archetype recommendation ─────────────────────
    case 'sfs:recommend': {
      try {
        const data = await client.recommend(
          msg.domain as string,
          msg.outputType as string,
          msg.probes as Record<string, boolean>,
        );
        post({ command: 'sfs:recommend:result', data });
      } catch {
        // Silently fail — local recommendations still work
      }
      break;
    }

    // ─── Generate skill ─────────────────────────────────
    case 'sfs:generate': {
      const config = msg.config as SfsSkillConfig;
      const online = await client.isAvailable();

      if (online) {
        // Online: use SFS backend
        try {
          // If using extension AI bridge, inject provider config
          const providerOverride = await maybeInjectBridge(client);

          post({ command: 'progress', message: 'Generating via Skill Forge backend...' });
          const data = await client.generate(config, providerOverride ?? undefined);
          post({ command: 'sfs:generate:result', success: true, data });
        } catch {
          // Fallback to offline if backend errors
          post({ command: 'progress', message: 'Backend error, using templates...' });
          const data = generateOfflineSkill(config);
          post({ command: 'sfs:generate:result', success: true, data, fallback: true });
        }
      } else {
        // Offline: use local templates
        post({ command: 'progress', message: 'Generating from templates...' });
        const data = generateOfflineSkill(config);
        post({ command: 'sfs:generate:result', success: true, data });
      }
      break;
    }

    // ─── Validate skill ─────────────────────────────────
    case 'sfs:validate': {
      try {
        const online = await client.isAvailable();
        if (online) {
          const data = await client.validate(
            msg.config as SfsSkillConfig,
            msg.files as SfsGeneratedFile[],
          );
          post({ command: 'sfs:validate:result', success: true, data });
        }
      } catch { /* offline: skip validation */ }
      break;
    }

    // ─── Write files to workspace ───────────────────────
    case 'workspace:write': {
      const name = msg.name as string;
      const files = msg.files as SfsGeneratedFile[];
      await writeFilesToWorkspace(name, files);
      post({ command: 'workspace:write:done' });
      break;
    }

    // ─── Preview a file ─────────────────────────────────
    case 'workspace:preview': {
      const content = msg.content as string;
      const language = (msg.language as string) || 'markdown';
      const doc = await vscode.workspace.openTextDocument({
        content,
        language,
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      break;
    }

    // ─── Open docs ──────────────────────────────────────
    case 'ui:openDocs': {
      vscode.env.openExternal(vscode.Uri.parse('https://clawdcontext.com/en/skill-forge'));
      break;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * If SFS backend has no AI but the extension does, inject a bridge
 * provider config via a query parameter or header.
 * Returns the provider name to use, or null.
 */
async function maybeInjectBridge(client: SfsClient): Promise<string | null> {
  if (!isAiEnabled()) { return null; }

  const health = await client.health();
  if (health.ai_available) {
    // SFS has its own AI, use it
    return null;
  }

  // Build bridge config from extension settings
  const config = getAiConfig();
  const bridgeConfig = buildBridgeConfig(config);
  if (!bridgeConfig) { return null; }

  // SFS /api/generate accepts a `provider` override, but the bridge config
  // needs to be applied server-side. For now, return null and let the SFS
  // fallback to template mode. Full bridge injection requires adding a
  // /api/providers/bridge endpoint on the SFS backend.
  // TODO: Implement bridge provider injection when SFS adds the endpoint
  return null;
}

/**
 * Write generated skill files to the workspace.
 */
async function writeFilesToWorkspace(name: string, files: SfsGeneratedFile[]): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    vscode.window.showErrorMessage('Open a workspace first to write skill files.');
    return;
  }

  const root = folders[0].uri;
  const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const skillDir = vscode.Uri.joinPath(root, '.clawdcontext', 'skills', sanitizedName);

  let firstFile: vscode.Uri | null = null;

  for (const file of files) {
    const filePath = file.path.replace(/^\.?\/?/, ''); // strip leading ./
    const fileUri = vscode.Uri.joinPath(skillDir, filePath);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(file.content, 'utf-8'));
    if (!firstFile) { firstFile = fileUri; }
  }

  // Open the main SKILL.md
  if (firstFile) {
    const doc = await vscode.workspace.openTextDocument(firstFile);
    await vscode.window.showTextDocument(doc);
  }

  vscode.window.showInformationMessage(
    `Skill "${sanitizedName}" created with ${files.length} files.`,
  );
}

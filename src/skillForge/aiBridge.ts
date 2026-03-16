/**
 * Skill Forge Studio — AI Bridge.
 *
 * Forwards the extension's AI provider settings (clawdcontext.ai.*)
 * to the SFS backend as an ephemeral provider. This lets users configure
 * AI once in VS Code settings and have it work for both the extension's
 * built-in AI features and Skill Forge generation.
 */

import * as vscode from 'vscode';
import type { SfsClient } from './sfsClient';
import { getAiConfig, isAiEnabled } from '../ai/provider';
import type { AiConfig } from '../ai/provider';

/** Provider type mapping: extension names → SFS brain.yaml types. */
const PROVIDER_TYPE_MAP: Record<string, string> = {
  'openai': 'openai_compat',
  'anthropic': 'anthropic',
  'azure-openai': 'azure_openai',
  'ollama': 'openai_compat',
  'deepseek': 'openai_compat',
};

/**
 * Check if the SFS backend already has a working AI provider.
 * If yes, no bridge needed — SFS has its own brain.yaml config.
 */
export async function sfsHasAiProvider(client: SfsClient): Promise<boolean> {
  try {
    const health = await client.health();
    return health.ai_available;
  } catch {
    return false;
  }
}

/**
 * Build an SFS-compatible provider config from the extension's AI settings.
 * Returns null if AI is not configured in the extension.
 */
export function buildBridgeConfig(config: AiConfig): Record<string, unknown> | null {
  if (config.provider === 'none') { return null; }

  const sfsType = PROVIDER_TYPE_MAP[config.provider];
  if (!sfsType) { return null; }

  const base: Record<string, unknown> = {
    name: `vscode_bridge_${config.provider}`,
    type: sfsType,
    model: config.model,
    api_key: config.apiKey,
    enabled: true,
  };

  // Provider-specific fields
  switch (config.provider) {
    case 'openai':
      base.base_url = config.baseUrl || 'https://api.openai.com/v1';
      break;
    case 'anthropic':
      base.api_key = config.apiKey;
      break;
    case 'azure-openai':
      base.type = 'azure_openai';
      base.azure_endpoint = config.baseUrl;
      base.azure_deployment = config.azureDeployment;
      base.azure_api_version = config.azureApiVersion || '2024-12-01-preview';
      break;
    case 'ollama':
      base.base_url = config.baseUrl || 'http://localhost:11434/v1';
      base.api_key = 'ollama'; // Ollama accepts any key
      break;
    case 'deepseek':
      base.base_url = config.baseUrl || 'https://api.deepseek.com/v1';
      break;
  }

  return base;
}

/**
 * Get summary of the AI bridge status for display in the webview.
 * Returns info about which AI source is active.
 */
export interface AiBridgeStatus {
  /** Whether any AI is available (SFS backend or extension bridge). */
  available: boolean;
  /** Source of AI: 'sfs' (backend's own config), 'bridge' (forwarded from extension), or 'none'. */
  source: 'sfs' | 'bridge' | 'none';
  /** Provider name. */
  provider: string;
  /** Model name. */
  model: string;
  /** Human-readable description. */
  label: string;
}

/**
 * Determine the current AI bridge status.
 * Priority: SFS backend's own AI → extension AI bridge → none.
 */
export async function getAiBridgeStatus(client: SfsClient): Promise<AiBridgeStatus> {
  // 1. Check if SFS backend has its own AI
  try {
    const health = await client.health();
    if (health.ai_available && health.active_provider) {
      return {
        available: true,
        source: 'sfs',
        provider: health.active_provider,
        model: health.active_model || '',
        label: `${health.active_provider} / ${health.active_model} (Skill Forge)`,
      };
    }
  } catch {
    // Backend not reachable — check extension AI
  }

  // 2. Check if extension has AI configured
  if (isAiEnabled()) {
    const config = getAiConfig();
    return {
      available: true,
      source: 'bridge',
      provider: config.provider,
      model: config.model,
      label: `${config.provider} / ${config.model} (VS Code bridge)`,
    };
  }

  return {
    available: false,
    source: 'none',
    provider: '',
    model: '',
    label: 'No AI configured',
  };
}

/**
 * Show a quick pick to let the user configure AI for Skill Forge.
 */
export async function promptAiSetup(): Promise<void> {
  const choice = await vscode.window.showQuickPick([
    { label: '$(gear) Configure VS Code AI Provider', description: 'Set up clawdcontext.ai.* settings', value: 'extension' },
    { label: '$(terminal) Configure Skill Forge brain.yaml', description: 'Edit brain.yaml directly', value: 'brain' },
  ], { placeHolder: 'How would you like to configure AI for Skill Forge?' });

  if (!choice) { return; }

  if (choice.value === 'extension') {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'clawdcontext.ai');
  } else {
    // Try to open brain.yaml
    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
      for (const folder of folders) {
        const candidates = [
          vscode.Uri.joinPath(folder.uri, 'skill_forge_studio', 'brain.yaml'),
          vscode.Uri.joinPath(folder.uri, 'brain.yaml'),
        ];
        for (const uri of candidates) {
          try {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
            return;
          } catch { /* not found, try next */ }
        }
      }
    }
    vscode.window.showWarningMessage('brain.yaml not found in workspace');
  }
}

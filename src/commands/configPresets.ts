/**
 * Config Presets — apply strict / balanced / permissive workspace profiles.
 *
 * Each preset adjusts CER thresholds, security scanner sensitivity,
 * lessons governance, and token budget to match different team policies.
 */

import * as vscode from 'vscode';
import { analyzeWorkspace } from './analyzeWorkspace';

// ─── Types ──────────────────────────────────────────────────────────

export type PresetName = 'strict' | 'balanced' | 'permissive';

interface ConfigPreset {
  name: PresetName;
  label: string;
  description: string;
  settings: Record<string, unknown>;
}

// ─── Preset Definitions ─────────────────────────────────────────────

const PRESETS: ConfigPreset[] = [
  {
    name: 'strict',
    label: '🔒 Strict',
    description: 'Tight CER thresholds, aggressive security scanning, strict lessons governance. Best for production agent configs and enterprise environments.',
    settings: {
      'clawdcontext.cerWarningThreshold': 0.5,
      'clawdcontext.cerCriticalThreshold': 0.3,
      'clawdcontext.lessonsTtlDays': 30,
      'clawdcontext.lessonsMaxEntries': 25,
      'clawdcontext.securityCodeBlockAware': false,  // scan even code blocks
      'clawdcontext.securityAllowlist': [],            // no suppressions
      'clawdcontext.tokenBudget': 200000,
    },
  },
  {
    name: 'balanced',
    label: '⚖️ Balanced',
    description: 'Sensible defaults for most teams. Code-block-aware security scanning, moderate CER thresholds, standard lessons governance.',
    settings: {
      'clawdcontext.cerWarningThreshold': 0.4,
      'clawdcontext.cerCriticalThreshold': 0.2,
      'clawdcontext.lessonsTtlDays': 60,
      'clawdcontext.lessonsMaxEntries': 50,
      'clawdcontext.securityCodeBlockAware': true,
      'clawdcontext.securityAllowlist': [],
      'clawdcontext.tokenBudget': 200000,
    },
  },
  {
    name: 'permissive',
    label: '🟢 Permissive',
    description: 'Relaxed thresholds for experimentation and prototyping. Lenient security scanning, generous lessons retention.',
    settings: {
      'clawdcontext.cerWarningThreshold': 0.3,
      'clawdcontext.cerCriticalThreshold': 0.1,
      'clawdcontext.lessonsTtlDays': 120,
      'clawdcontext.lessonsMaxEntries': 100,
      'clawdcontext.securityCodeBlockAware': true,
      'clawdcontext.securityAllowlist': ['SEC_RECON', 'SEC_PERSIST'],
      'clawdcontext.tokenBudget': 200000,
    },
  },
];

// ─── Command ────────────────────────────────────────────────────────

/**
 * Apply a config preset to the workspace.
 */
export async function applyConfigPreset(): Promise<void> {
  const pick = await vscode.window.showQuickPick(
    PRESETS.map(p => ({
      label: p.label,
      description: p.name,
      detail: p.description,
      preset: p,
    })),
    {
      title: 'Apply Config Preset',
      placeHolder: 'Choose a workspace policy profile',
    },
  );

  if (!pick) { return; }

  const preset = pick.preset;

  // Confirm before applying
  const confirm = await vscode.window.showWarningMessage(
    `Apply "${preset.label}" preset? This will overwrite ${Object.keys(preset.settings).length} workspace settings.`,
    { modal: true },
    'Apply',
  );

  if (confirm !== 'Apply') { return; }

  // Apply each setting at workspace level
  const config = vscode.workspace.getConfiguration();
  for (const [key, value] of Object.entries(preset.settings)) {
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }

  vscode.window.showInformationMessage(
    `✅ Applied "${preset.label}" preset (${Object.keys(preset.settings).length} settings updated). Re-analyzing workspace...`,
  );

  // Re-analyze with new thresholds
  await analyzeWorkspace();
}

/**
 * Show the currently active preset (or "Custom" if manually configured).
 */
export function detectActivePreset(): PresetName | 'custom' {
  const config = vscode.workspace.getConfiguration();

  for (const preset of PRESETS) {
    let matches = true;
    for (const [key, value] of Object.entries(preset.settings)) {
      const current = config.get(key);
      if (JSON.stringify(current) !== JSON.stringify(value)) {
        matches = false;
        break;
      }
    }
    if (matches) { return preset.name; }
  }

  return 'custom';
}

/**
 * @module modelRegistry
 * Maps known AI models to their official context window sizes (in tokens).
 * Used by the CER calculator to auto-resolve the token budget when the user
 * hasn't overridden `clawdcontext.tokenBudget`.
 *
 * Sources: official provider documentation as of 2025-Q2.
 * Prefix matching is used so that dated snapshot IDs (e.g. "gpt-4.1-2025-04-14")
 * resolve to the base model's context window.
 */

import * as vscode from 'vscode';
import { getAiConfig } from './provider';

// ─── Registry ───────────────────────────────────────────────────────

interface ModelEntry {
  /** Context window in tokens. */
  contextWindow: number;
  /** Optional human-friendly label shown in the dashboard. */
  label?: string;
}

/**
 * Known model → context window mapping.
 * Keys are lowercase. Lookup uses longest-prefix matching so that
 * "gpt-4.1-mini-2025-04-14" matches "gpt-4.1-mini".
 */
const MODEL_REGISTRY: Map<string, ModelEntry> = new Map([
  // ── OpenAI ──────────────────────────────────────────────────────
  ['o3',                          { contextWindow: 200_000, label: 'OpenAI o3' }],
  ['o3-mini',                     { contextWindow: 200_000, label: 'OpenAI o3-mini' }],
  ['o4-mini',                     { contextWindow: 200_000, label: 'OpenAI o4-mini' }],
  ['gpt-4.1',                     { contextWindow: 1_047_576, label: 'GPT-4.1' }],
  ['gpt-4.1-mini',                { contextWindow: 1_047_576, label: 'GPT-4.1 Mini' }],
  ['gpt-4.1-nano',                { contextWindow: 1_047_576, label: 'GPT-4.1 Nano' }],
  ['gpt-4o',                      { contextWindow: 128_000, label: 'GPT-4o' }],
  ['gpt-4o-mini',                 { contextWindow: 128_000, label: 'GPT-4o Mini' }],
  ['gpt-4-turbo',                 { contextWindow: 128_000, label: 'GPT-4 Turbo' }],
  ['gpt-4',                       { contextWindow: 8_192,   label: 'GPT-4' }],
  ['gpt-3.5-turbo',               { contextWindow: 16_385,  label: 'GPT-3.5 Turbo' }],

  // ── Anthropic ───────────────────────────────────────────────────
  ['claude-sonnet-4',             { contextWindow: 200_000, label: 'Claude Sonnet 4' }],
  ['claude-opus-4',               { contextWindow: 200_000, label: 'Claude Opus 4' }],
  ['claude-3.7-sonnet',           { contextWindow: 200_000, label: 'Claude 3.7 Sonnet' }],
  ['claude-3.5-sonnet',           { contextWindow: 200_000, label: 'Claude 3.5 Sonnet' }],
  ['claude-3.5-haiku',            { contextWindow: 200_000, label: 'Claude 3.5 Haiku' }],
  ['claude-3-opus',               { contextWindow: 200_000, label: 'Claude 3 Opus' }],
  ['claude-3-sonnet',             { contextWindow: 200_000, label: 'Claude 3 Sonnet' }],
  ['claude-3-haiku',              { contextWindow: 200_000, label: 'Claude 3 Haiku' }],

  // ── DeepSeek ────────────────────────────────────────────────────
  ['deepseek-chat',               { contextWindow: 64_000,  label: 'DeepSeek Chat' }],
  ['deepseek-coder',              { contextWindow: 64_000,  label: 'DeepSeek Coder' }],
  ['deepseek-reasoner',           { contextWindow: 64_000,  label: 'DeepSeek Reasoner' }],

  // ── Ollama / Local (common defaults) ────────────────────────────
  ['llama3.2',                    { contextWindow: 128_000, label: 'Llama 3.2' }],
  ['llama3.1',                    { contextWindow: 128_000, label: 'Llama 3.1' }],
  ['llama3',                      { contextWindow: 8_192,   label: 'Llama 3' }],
  ['mistral',                     { contextWindow: 32_768,  label: 'Mistral' }],
  ['mixtral',                     { contextWindow: 32_768,  label: 'Mixtral' }],
  ['codellama',                   { contextWindow: 16_384,  label: 'Code Llama' }],
  ['gemma2',                      { contextWindow: 8_192,   label: 'Gemma 2' }],
  ['gemma',                       { contextWindow: 8_192,   label: 'Gemma' }],
  ['phi3',                        { contextWindow: 128_000, label: 'Phi-3' }],
  ['qwen2.5',                     { contextWindow: 32_768,  label: 'Qwen 2.5' }],
  ['qwen2',                       { contextWindow: 32_768,  label: 'Qwen 2' }],
  ['command-r-plus',              { contextWindow: 128_000, label: 'Command R+' }],
  ['command-r',                   { contextWindow: 128_000, label: 'Command R' }],
]);

// Pre-sorted keys by length descending for longest-prefix matching.
const SORTED_KEYS = [...MODEL_REGISTRY.keys()].sort((a, b) => b.length - a.length);

// ─── Lookup ─────────────────────────────────────────────────────────

/**
 * Look up a model's context window size using longest-prefix matching.
 * Returns `undefined` if the model is not in the registry.
 */
export function lookupModelContextWindow(model: string): ModelEntry | undefined {
  const normalised = model.toLowerCase().trim();
  if (!normalised) { return undefined; }

  // Exact match first (fast path).
  const exact = MODEL_REGISTRY.get(normalised);
  if (exact) { return exact; }

  // Longest-prefix match (handles dated snapshots like "gpt-4.1-mini-2025-04-14").
  for (const key of SORTED_KEYS) {
    if (normalised.startsWith(key)) {
      return MODEL_REGISTRY.get(key);
    }
  }

  return undefined;
}

// ─── Effective Token Budget ─────────────────────────────────────────

const DEFAULT_TOKEN_BUDGET = 200_000;

/**
 * Resolve the effective token budget for CER calculations.
 *
 * Priority:
 * 1. User-configured `clawdcontext.tokenBudget` (if explicitly changed from default)
 * 2. Model registry lookup (based on configured AI model)
 * 3. Fallback to DEFAULT_TOKEN_BUDGET (200K)
 */
export function getEffectiveTokenBudget(): { budget: number; source: 'user' | 'model' | 'default'; model?: string } {
  const config = vscode.workspace.getConfiguration('clawdcontext');
  const inspection = config.inspect<number>('tokenBudget');

  // If user explicitly set a value at any scope, honour it.
  const userOverride = inspection?.workspaceFolderValue
    ?? inspection?.workspaceValue
    ?? inspection?.globalValue;

  if (userOverride !== undefined) {
    return { budget: userOverride, source: 'user' };
  }

  // Try to resolve from the configured AI model.
  const aiConfig = getAiConfig();
  if (aiConfig.model) {
    const entry = lookupModelContextWindow(aiConfig.model);
    if (entry) {
      return { budget: entry.contextWindow, source: 'model', model: entry.label ?? aiConfig.model };
    }
  }

  return { budget: DEFAULT_TOKEN_BUDGET, source: 'default' };
}

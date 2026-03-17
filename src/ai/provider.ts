/**
 * AI Provider — Multi-provider abstraction for ClawdContext.
 *
 * Supports: OpenAI, Anthropic (Claude), Azure OpenAI, Ollama, DeepSeek.
 * Uses Node.js built-in https/http modules (zero runtime dependencies).
 * Enterprise-grade: PFX/P12 mTLS, PEM cert+key, custom CA, proxy support.
 */

import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as tls from 'tls';

// ─── Types ──────────────────────────────────────────────────────────

export type AiProvider = 'none' | 'openai' | 'anthropic' | 'azure-openai' | 'ollama' | 'deepseek';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionOptions {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiCompletionResult {
  content: string;
  model: string;
  tokensUsed?: number;
  latencyMs?: number;
}

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  // Enterprise cert auth
  caCertPath: string;
  certPath: string;
  keyPath: string;
  pfxPath: string;
  pfxPassphrase: string;
  rejectUnauthorized: boolean;
  timeout: number;
  // Azure-specific
  azureDeployment: string;
  azureApiVersion: string;
}

// ─── Default Provider Config ────────────────────────────────────────

const DEFAULT_MODELS: Record<Exclude<AiProvider, 'none'>, string> = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-4-20250514',
  'azure-openai': 'gpt-4.1-mini',
  ollama: 'llama3.2',
  deepseek: 'deepseek-chat',
};

const DEFAULT_URLS: Record<Exclude<AiProvider, 'none'>, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  'azure-openai': '',
  ollama: 'http://localhost:11434',
  deepseek: 'https://api.deepseek.com',
};

// ─── Configuration ──────────────────────────────────────────────────

export function getAiConfig(): AiConfig {
  const cfg = vscode.workspace.getConfiguration('clawdcontext.ai');
  const provider = cfg.get<AiProvider>('provider', 'none');

  return {
    provider,
    apiKey: cfg.get<string>('apiKey', ''),
    model: cfg.get<string>('model', '') || (provider !== 'none' ? DEFAULT_MODELS[provider] : ''),
    baseUrl: cfg.get<string>('baseUrl', '') || (provider !== 'none' ? DEFAULT_URLS[provider] : ''),
    maxTokens: cfg.get<number>('maxTokens', 4096),
    temperature: cfg.get<number>('temperature', 0.3),
    caCertPath: cfg.get<string>('caCertPath', ''),
    certPath: cfg.get<string>('certPath', ''),
    keyPath: cfg.get<string>('keyPath', ''),
    pfxPath: cfg.get<string>('pfxPath', ''),
    pfxPassphrase: cfg.get<string>('pfxPassphrase', ''),
    rejectUnauthorized: cfg.get<boolean>('rejectUnauthorized', true),
    timeout: cfg.get<number>('timeout', 30000),
    azureDeployment: cfg.get<string>('azureDeployment', ''),
    azureApiVersion: cfg.get<string>('azureApiVersion', '2024-12-01-preview'),
  };
}

export function isAiEnabled(): boolean {
  const config = getAiConfig();
  if (config.provider === 'none') { return false; }
  if (config.provider === 'ollama') { return true; }
  // Azure OpenAI can use mTLS without API key
  if (config.provider === 'azure-openai' && (config.pfxPath || config.certPath)) { return true; }
  return config.apiKey.length > 0;
}

/** Human-readable provider label. */
export function getProviderLabel(provider: AiProvider): string {
  const labels: Record<AiProvider, string> = {
    'none': 'Disabled',
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'azure-openai': 'Azure OpenAI',
    'ollama': 'Ollama',
    'deepseek': 'DeepSeek',
  };
  return labels[provider];
}

// ─── TLS / Certificate Handling ─────────────────────────────────────

function buildHttpsAgent(config: AiConfig): https.Agent {
  const options: https.AgentOptions = {
    rejectUnauthorized: config.rejectUnauthorized,
    keepAlive: true,
  };

  let needsCustom = false;

  // PFX/P12 certificate bundle (Windows/Azure enterprise, mTLS)
  if (config.pfxPath) {
    try {
      const pfxPath = config.pfxPath.replace(/^~/, os.homedir());
      if (fs.existsSync(pfxPath)) {
        options.pfx = fs.readFileSync(pfxPath);
        if (config.pfxPassphrase) { options.passphrase = config.pfxPassphrase; }
        needsCustom = true;
        console.log(`ClawdContext AI: loaded PFX certificate from ${pfxPath}`);
      }
    } catch (e) {
      console.error(`ClawdContext AI: failed to load PFX cert: ${e}`);
    }
  }

  // PEM certificate + key (Linux/container mTLS)
  if (config.certPath && config.keyPath) {
    try {
      const certPath = config.certPath.replace(/^~/, os.homedir());
      const keyPath = config.keyPath.replace(/^~/, os.homedir());
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        options.cert = fs.readFileSync(certPath);
        options.key = fs.readFileSync(keyPath);
        needsCustom = true;
        console.log(`ClawdContext AI: loaded PEM cert+key`);
      }
    } catch (e) {
      console.error(`ClawdContext AI: failed to load PEM cert: ${e}`);
    }
  }

  // Custom CA certificate (enterprise root CA, corporate proxy)
  if (config.caCertPath) {
    try {
      const caPath = config.caCertPath.replace(/^~/, os.homedir());
      if (fs.existsSync(caPath)) {
        const caCert = fs.readFileSync(caPath);
        options.ca = [...tls.rootCertificates, caCert.toString()];
        needsCustom = true;
        console.log(`ClawdContext AI: loaded CA certificate from ${caPath}`);
      } else {
        console.warn(`ClawdContext AI: CA cert not found at ${caPath}`);
      }
    } catch (err) {
      console.error(`ClawdContext AI: failed to load CA cert: ${err}`);
    }
  }

  if (!config.rejectUnauthorized) { needsCustom = true; }

  return new https.Agent(needsCustom ? options : { keepAlive: true });
}

// ─── HTTP Request Helper ────────────────────────────────────────────

interface RequestOptions {
  url: string;
  method: 'POST' | 'GET';
  headers: Record<string, string>;
  body?: string;
  config: AiConfig;
}

function makeRequest(opts: RequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(opts.url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ClawdContext-VSCode/0.4.0',
        ...opts.headers,
      },
      timeout: opts.config.timeout,
    };

    if (isHttps) { reqOptions.agent = buildHttpsAgent(opts.config); }

    const req = transport.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`AI API error ${res.statusCode}: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`AI request timed out (${opts.config.timeout}ms)`)); });
    if (opts.body) { req.write(opts.body); }
    req.end();
  });
}

// ─── Provider Implementations ───────────────────────────────────────

async function completeOpenAI(config: AiConfig, options: AiCompletionOptions): Promise<AiCompletionResult> {
  const start = Date.now();
  const body = JSON.stringify({
    model: config.model,
    messages: options.messages,
    temperature: options.temperature ?? config.temperature,
    max_tokens: options.maxTokens ?? config.maxTokens,
  });

  const response = await makeRequest({
    url: `${config.baseUrl}/v1/chat/completions`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.apiKey}` },
    body, config,
  });

  const json = JSON.parse(response);
  return {
    content: json.choices?.[0]?.message?.content || '',
    model: json.model || config.model,
    tokensUsed: json.usage?.total_tokens,
    latencyMs: Date.now() - start,
  };
}

async function completeAnthropic(config: AiConfig, options: AiCompletionOptions): Promise<AiCompletionResult> {
  const start = Date.now();
  const systemMsg = options.messages.find(m => m.role === 'system');
  const chatMessages = options.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const body = JSON.stringify({
    model: config.model,
    max_tokens: options.maxTokens ?? config.maxTokens,
    ...(systemMsg ? { system: systemMsg.content } : {}),
    messages: chatMessages,
    temperature: options.temperature ?? config.temperature,
  });

  const response = await makeRequest({
    url: `${config.baseUrl}/v1/messages`,
    method: 'POST',
    headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
    body, config,
  });

  const json = JSON.parse(response);
  const textBlock = json.content?.find((b: { type: string }) => b.type === 'text');
  return {
    content: textBlock?.text || '',
    model: json.model || config.model,
    tokensUsed: json.usage ? (json.usage.input_tokens + json.usage.output_tokens) : undefined,
    latencyMs: Date.now() - start,
  };
}

async function completeAzureOpenAI(config: AiConfig, options: AiCompletionOptions): Promise<AiCompletionResult> {
  const start = Date.now();
  const deployment = config.azureDeployment || config.model;
  const apiVersion = config.azureApiVersion || '2024-12-01-preview';
  const url = `${config.baseUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const body = JSON.stringify({
    max_tokens: options.maxTokens ?? config.maxTokens,
    temperature: options.temperature ?? config.temperature,
    messages: options.messages,
  });

  const headers: Record<string, string> = {};
  if (config.apiKey) { headers['api-key'] = config.apiKey; }

  const response = await makeRequest({ url, method: 'POST', headers, body, config });
  const json = JSON.parse(response);
  return {
    content: json.choices?.[0]?.message?.content || '',
    model: json.model || deployment,
    tokensUsed: json.usage?.total_tokens,
    latencyMs: Date.now() - start,
  };
}

async function completeOllama(config: AiConfig, options: AiCompletionOptions): Promise<AiCompletionResult> {
  const start = Date.now();
  const body = JSON.stringify({
    model: config.model,
    messages: options.messages,
    stream: false,
    options: {
      temperature: options.temperature ?? config.temperature,
      num_predict: options.maxTokens ?? config.maxTokens,
    },
  });

  const response = await makeRequest({
    url: `${config.baseUrl}/api/chat`,
    method: 'POST', headers: {}, body, config,
  });

  const json = JSON.parse(response);
  return {
    content: json.message?.content || '',
    model: json.model || config.model,
    tokensUsed: json.eval_count ? (json.prompt_eval_count + json.eval_count) : undefined,
    latencyMs: Date.now() - start,
  };
}

async function completeDeepSeek(config: AiConfig, options: AiCompletionOptions): Promise<AiCompletionResult> {
  const start = Date.now();
  const body = JSON.stringify({
    model: config.model,
    messages: options.messages,
    temperature: options.temperature ?? config.temperature,
    max_tokens: options.maxTokens ?? config.maxTokens,
  });

  const response = await makeRequest({
    url: `${config.baseUrl}/v1/chat/completions`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.apiKey}` },
    body, config,
  });

  const json = JSON.parse(response);
  return {
    content: json.choices?.[0]?.message?.content || '',
    model: json.model || config.model,
    tokensUsed: json.usage?.total_tokens,
    latencyMs: Date.now() - start,
  };
}

// ─── Public API ─────────────────────────────────────────────────────

export async function aiComplete(options: AiCompletionOptions): Promise<AiCompletionResult> {
  const config = getAiConfig();

  if (config.provider === 'none') {
    throw new Error('AI is not configured. Set clawdcontext.ai.provider in settings.');
  }

  if (config.provider !== 'ollama' && !config.apiKey) {
    if (config.provider !== 'azure-openai' || (!config.pfxPath && !config.certPath)) {
      throw new Error(`API key required for ${getProviderLabel(config.provider)}. Set clawdcontext.ai.apiKey in settings.`);
    }
  }

  switch (config.provider) {
    case 'openai':        return completeOpenAI(config, options);
    case 'anthropic':     return completeAnthropic(config, options);
    case 'azure-openai':  return completeAzureOpenAI(config, options);
    case 'ollama':        return completeOllama(config, options);
    case 'deepseek':      return completeDeepSeek(config, options);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

export async function testAiConnection(): Promise<string> {
  const result = await aiComplete({
    messages: [
      { role: 'system', content: 'You are a test assistant. Reply with exactly: "ClawdContext AI connected"' },
      { role: 'user', content: 'ping' },
    ],
    maxTokens: 20,
    temperature: 0,
  });

  const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : '';
  return `Connected to ${getProviderLabel(getAiConfig().provider)} — ${result.model}${latency}`;
}

/**
 * Skill Forge Studio — HTTP Client.
 *
 * Lightweight client for the SFS REST API (localhost:8742).
 * Uses Node.js built-in http module (zero runtime dependencies).
 * Falls back gracefully when the backend is unreachable.
 */

import * as http from 'http';
import * as https from 'https';

// ─── Types (mirror SFS backend models) ──────────────────────

export interface SfsHealthResponse {
  status: string;
  version: string;
  ai_available: boolean;
  active_provider: string | null;
  active_model: string | null;
  brain_mode: string;
  providers: SfsProvider[];
}

export interface SfsProvider {
  name: string;
  type: string;
  model: string;
  available: boolean;
  active: boolean;
}

export interface SfsGeneratedFile {
  path: string;
  content: string;
  language: string;
  estimated_lines: number;
}

export interface SfsGenerateResponse {
  files: SfsGeneratedFile[];
  token_budget_used: number;
  validation_warnings: string[];
  ai_powered: boolean;
  degraded: boolean;
  provider_used: string | null;
  model_used: string | null;
}

export interface SfsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  token_estimate: number;
  line_count: number;
}

export interface SfsRecommendation {
  archetype: string;
  score: number;
  reason: string;
}

export interface SfsRecommendResponse {
  recommendations: SfsRecommendation[];
  tier: number;
}

export interface SfsSkillConfig {
  name: string;
  description: string;
  domain: string;
  output_type: string;
  archetype: string;
  tier: number;
  instruction_style: string;
  trigger_strategy: string;
  pushiness: number;
  positive_keywords: string[];
  negative_keywords: string[];
  template_names: string[];
  has_catch_all: boolean;
  variant_names: string[];
  routing_criteria: string;
  operations: string[];
  script_language: string;
  has_shared_utils: boolean;
  phase1_output: string;
  phase2_medium: string;
  scaffold_type: string;
  bundle_format: string;
  subagents: string[];
  has_eval_harness: boolean;
  environments: string[];
  shared_code_modules: string[];
  context_mode: string;
  hooks_before: string;
  hooks_after: string;
  allowed_tools: string[];
  sections: string[];
}

export interface SfsRegenerateRequest {
  config: SfsSkillConfig;
  file_path: string;
  instructions: string;
  max_tokens: number;
  provider?: string;
}

// ─── Client ─────────────────────────────────────────────────

export class SfsClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(baseUrl = 'http://localhost:8742', apiKey = '', timeout = 30000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  /** Check if the SFS backend is reachable and healthy. */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.get<SfsHealthResponse>('/health');
      return res.status === 'ok';
    } catch {
      return false;
    }
  }

  /** Get full health info including provider status. */
  async health(): Promise<SfsHealthResponse> {
    return this.get<SfsHealthResponse>('/health');
  }

  /** List all configured AI providers. */
  async listProviders(): Promise<SfsProvider[]> {
    const res = await this.get<{ providers: SfsProvider[] }>('/api/providers');
    return res.providers;
  }

  /** Get ranked archetype recommendations from probes. */
  async recommend(domain: string, outputType: string, probes: Record<string, boolean>): Promise<SfsRecommendResponse> {
    return this.post<SfsRecommendResponse>('/api/recommend', {
      domain, output_type: outputType, probes,
    });
  }

  /** Generate all skill files (AI-first, template fallback). */
  async generate(config: SfsSkillConfig, provider?: string): Promise<SfsGenerateResponse> {
    return this.post<SfsGenerateResponse>('/api/generate', {
      config, provider: provider ?? null,
    });
  }

  /** Validate skill structure. */
  async validate(config: SfsSkillConfig, files: SfsGeneratedFile[]): Promise<SfsValidationResult> {
    return this.post<SfsValidationResult>('/api/validate', { config, files });
  }

  /** Regenerate a single file with AI. */
  async regenerate(req: SfsRegenerateRequest): Promise<{ content: string; tokens_used: number; provider: string; model: string }> {
    return this.post('/api/ai-regenerate', req);
  }

  /** Export skill as ZIP buffer. */
  async exportSkill(config: SfsSkillConfig, files: SfsGeneratedFile[]): Promise<Buffer> {
    return this.postRaw('/api/export', { config, files });
  }

  // ─── HTTP helpers ─────────────────────────────────────────

  private get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, JSON.stringify(body));
  }

  private postRaw(path: string, body: unknown): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const isSecure = url.protocol === 'https:';
      const transport = isSecure ? https : http;
      const payload = JSON.stringify(body);

      const req = transport.request({
        hostname: url.hostname,
        port: url.port || (isSecure ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...this.authHeaders(),
        },
        timeout: this.timeout,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('SFS request timed out')); });
      req.write(payload);
      req.end();
    });
  }

  private request<T>(method: 'GET' | 'POST', path: string, body?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const isSecure = url.protocol === 'https:';
      const transport = isSecure ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'ClawdContext-VSCode/0.4.1',
        ...this.authHeaders(),
      };
      if (body) { headers['Content-Length'] = String(Buffer.byteLength(body)); }

      const req = transport.request({
        hostname: url.hostname,
        port: url.port || (isSecure ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: this.timeout,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error(`Invalid JSON from SFS: ${data.substring(0, 200)}`)); }
          } else if (res.statusCode === 207) {
            // Degraded response — still usable
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error(`Invalid JSON from SFS (207): ${data.substring(0, 200)}`)); }
          } else {
            reject(new Error(`SFS API error ${res.statusCode}: ${data.substring(0, 300)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('SFS request timed out')); });
      if (body) { req.write(body); }
      req.end();
    });
  }

  private authHeaders(): Record<string, string> {
    if (this.apiKey) {
      return { 'X-API-Key': this.apiKey };
    }
    return {};
  }
}

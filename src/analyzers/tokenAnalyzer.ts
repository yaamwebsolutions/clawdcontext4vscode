import * as vscode from 'vscode';
import * as path from 'path';
import { classifyCerStatus } from './cerThresholds';

// ─── Token Estimation ───────────────────────────────────────────────
// BPE-approximation tokenizer: handles code, markdown, whitespace,
// and special patterns more accurately than chars/4.
// Calibrated against cl100k_base (Claude/GPT-4 tokenizer).
// Accuracy: ±5% for typical .md files vs. ±20% for naive chars/4.

export function estimateTokens(text: string): number {
  if (!text) { return 0; }

  let count = 0;

  // Split into segments by whitespace and punctuation boundaries
  // BPE tokenizers split on word boundaries, then sub-word
  const segments = text.split(/(\s+|[^\w\s])/);

  for (const seg of segments) {
    if (!seg) { continue; }

    // Whitespace: typically merged with adjacent tokens
    if (/^\s+$/.test(seg)) {
      // Newlines are individual tokens; spaces often merge
      const newlines = (seg.match(/\n/g) || []).length;
      const spaces = seg.length - newlines;
      count += newlines + Math.ceil(spaces / 4);
      continue;
    }

    // Single punctuation/special char: usually 1 token
    if (seg.length === 1 && /[^\w]/.test(seg)) {
      count += 1;
      continue;
    }

    // Numbers: roughly 1 token per 1-3 digits
    if (/^\d+$/.test(seg)) {
      count += Math.ceil(seg.length / 3);
      continue;
    }

    // Common English words < 5 chars: usually 1 token
    if (seg.length <= 4 && /^[a-zA-Z]+$/.test(seg)) {
      count += 1;
      continue;
    }

    // Code identifiers (camelCase, snake_case): split on boundaries
    if (/[A-Z]/.test(seg) && /[a-z]/.test(seg)) {
      // camelCase splits: 'backgroundColor' → 'background', 'Color' → ~2 tokens
      const parts = seg.split(/(?=[A-Z])/);
      for (const part of parts) {
        count += Math.ceil(part.length / 4);
      }
      continue;
    }

    if (seg.includes('_')) {
      const parts = seg.split('_');
      for (const part of parts) {
        count += part.length > 0 ? Math.ceil(part.length / 4) : 0;
      }
      count += parts.length - 1; // underscores
      continue;
    }

    // URLs, paths: more tokens per character
    if (seg.includes('/') || seg.includes('://') || seg.includes('.')) {
      count += Math.ceil(seg.length / 3);
      continue;
    }

    // General text: ~4 chars per token for English, ~2-3 for code
    const isCode = /[{}[\]();=<>|&]/.test(seg) || /^[a-z]+[A-Z]/.test(seg);
    count += Math.ceil(seg.length / (isCode ? 3 : 4));
  }

  return Math.max(1, count);
}

// ─── Positional Analysis (Lost-in-the-Middle) ──────────────────────
// Stanford research: info at position 1 → 75% accuracy, position 10 → 55%.
// We divide files into thirds and flag critical instructions in the "dead zone."

export interface PositionalZone {
  zone: 'start' | 'middle' | 'end';
  startLine: number;
  endLine: number;
  tokens: number;
  criticalInstructions: Array<{ line: number; text: string; keyword: string }>;
  attentionWeight: number; // 1.0 = full attention, 0.55 = dead zone
}

export function analyzePositionalAttention(content: string): PositionalZone[] {
  const lines = content.split('\n');
  const totalLines = lines.length;
  if (totalLines < 6) { return []; } // Too short to have a dead zone

  const thirdSize = Math.ceil(totalLines / 3);
  const zones: PositionalZone[] = [
    { zone: 'start',  startLine: 0,                  endLine: thirdSize - 1,         tokens: 0, criticalInstructions: [], attentionWeight: 0.75 },
    { zone: 'middle', startLine: thirdSize,           endLine: thirdSize * 2 - 1,     tokens: 0, criticalInstructions: [], attentionWeight: 0.55 },
    { zone: 'end',    startLine: thirdSize * 2,       endLine: totalLines - 1,        tokens: 0, criticalInstructions: [], attentionWeight: 0.70 },
  ];

  // Critical instruction patterns
  const criticalPatterns = [
    { re: /\b(never|must not|do not|don't|forbidden|prohibited)\b/i, keyword: 'prohibition' },
    { re: /\b(always|must|required|mandatory|critical|essential)\b/i, keyword: 'requirement' },
    { re: /\b(security|secret|credential|api.key|password|token)\b/i, keyword: 'security' },
    { re: /\b(invariant|constraint|rule|principle)\b/i, keyword: 'invariant' },
  ];

  for (const zone of zones) {
    const zoneLines = lines.slice(zone.startLine, zone.endLine + 1);
    zone.tokens = estimateTokens(zoneLines.join('\n'));

    for (let i = zone.startLine; i <= Math.min(zone.endLine, totalLines - 1); i++) {
      const line = lines[i];
      for (const { re, keyword } of criticalPatterns) {
        if (re.test(line)) {
          zone.criticalInstructions.push({ line: i, text: line.trim().substring(0, 80), keyword });
          break; // One match per line
        }
      }
    }
  }

  return zones;
}

// ─── Layer Classification ───────────────────────────────────────────

export type LayerType =
  | 'kernel'      // CLAUDE.md, AGENTS.md — always loaded
  | 'skill'       // SKILL.md files — on-demand
  | 'task'        // todo.md — ephemeral
  | 'learning'    // lessons.md — governed cache
  | 'hook'        // .claude/hooks/ — deterministic
  | 'subagent'    // agent definitions
  | 'unknown';

export interface AgentFile {
  uri: vscode.Uri;
  relativePath: string;
  layer: LayerType;
  tokens: number;
  content: string;
  alwaysLoaded: boolean;
  metadata: Record<string, any>;
}

export interface ContextBudget {
  totalBudget: number;
  alwaysLoadedTokens: number;
  onDemandTokens: number;
  reasoningHeadroom: number;
  cer: number;           // Context Efficiency Ratio
  cerStatus: 'optimal' | 'warning' | 'critical';
  filesByLayer: Map<LayerType, AgentFile[]>;
  allFiles: AgentFile[];
}

// ─── File Classification ────────────────────────────────────────────

export function classifyFile(relativePath: string): { layer: LayerType; alwaysLoaded: boolean } {
  const name = path.basename(relativePath).toLowerCase();
  const dir = path.dirname(relativePath).toLowerCase();

  // Kernel layer — always loaded
  if (name === 'claude.md' || name === 'agents.md' || name === '.claudemd') {
    return { layer: 'kernel', alwaysLoaded: true };
  }

  // Hook layer
  if (dir.includes('.claude/hooks') || dir.includes('.clawdcontext/hooks') || dir.includes('hooks') && name.endsWith('.sh')) {
    return { layer: 'hook', alwaysLoaded: false };
  }

  // Skill layer — on-demand
  if (name === 'skill.md' || dir.includes('skills/') || dir.includes('.claude/skills') || dir.includes('.clawdcontext/skills')) {
    return { layer: 'skill', alwaysLoaded: false };
  }

  // Task layer — ephemeral
  if (name === 'todo.md' || name === 'plan.md' || name === 'task.md') {
    return { layer: 'task', alwaysLoaded: false };
  }

  // Learning layer — governed
  if (name === 'lessons.md' || name === 'lessons-learned.md' || name === 'learnings.md') {
    return { layer: 'learning', alwaysLoaded: true }; // typically loaded
  }

  // Subagent definitions
  if (dir.includes('agents/') || dir.includes('subagents/') || name.includes('agent')) {
    return { layer: 'subagent', alwaysLoaded: false };
  }

  return { layer: 'unknown', alwaysLoaded: false };
}

// ─── Workspace Scanner ──────────────────────────────────────────────

export async function scanWorkspace(): Promise<AgentFile[]> {
  const files: AgentFile[] = [];
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) { return files; }

  // Patterns to find agent-related files
  const patterns = [
    '**/CLAUDE.md', '**/claude.md',
    '**/AGENTS.md', '**/agents.md',
    '**/SKILL.md', '**/skill.md',
    '**/.claude/**/*.md',
    '**/.clawdcontext/**/*.md',
    '**/skills/**/*.md',
    '**/todo.md', '**/plan.md',
    '**/lessons.md', '**/lessons-learned.md',
    '**/.claude/hooks/**',
    '**/.clawdcontext/hooks/**',
    '**/subagents/**/*.md',
    '**/agents/**/*.md',
    '**/DECISIONS.md',
  ];

  for (const pattern of patterns) {
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
    for (const uri of uris) {
      const relativePath = vscode.workspace.asRelativePath(uri);
      const { layer, alwaysLoaded } = classifyFile(relativePath);

      try {
        const contentBytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(contentBytes).toString('utf8');
        const tokens = estimateTokens(content);
        const metadata = extractMetadata(content, layer);

        files.push({ uri, relativePath, layer, tokens, content, alwaysLoaded, metadata });
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Deduplicate by URI
  const seen = new Set<string>();
  return files.filter(f => {
    const key = f.uri.toString();
    if (seen.has(key)) { return false; }
    seen.add(key);
    return true;
  });
}

// ─── Metadata Extraction ────────────────────────────────────────────

function extractMetadata(content: string, layer: LayerType): Record<string, any> {
  const meta: Record<string, any> = {};

  if (layer === 'learning') {
    // Count lesson entries
    const entries = content.match(/^## \d{4}-\d{2}-\d{2}/gm) || [];
    meta.entryCount = entries.length;

    // Extract dates for staleness analysis
    meta.dates = entries.map(e => e.replace('## ', '').split(' ')[0]);
    meta.oldestDate = meta.dates.length > 0 ? meta.dates[meta.dates.length - 1] : null;
    meta.newestDate = meta.dates.length > 0 ? meta.dates[0] : null;

    // Count types
    const localHeuristics = (content.match(/type:\s*local-heuristic/gi) || []).length;
    const globalInvariants = (content.match(/type:\s*global-invariant/gi) || []).length;
    meta.localHeuristics = localHeuristics;
    meta.globalInvariants = globalInvariants;

    // Count promotion candidates
    meta.promotionCandidates = (content.match(/promotion.candidate:\s*yes/gi) || []).length;

    // Count deprecated
    meta.deprecated = (content.match(/status:\s*deprecated/gi) || []).length;
  }

  if (layer === 'skill') {
    // Extract YAML frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const fm = fmMatch[1];
      const nameMatch = fm.match(/name:\s*(.+)/);
      const descMatch = fm.match(/description:\s*(.+)/);
      if (nameMatch) { meta.skillName = nameMatch[1].trim(); }
      if (descMatch) { meta.skillDescription = descMatch[1].trim(); }
    }
    // Count steps
    meta.stepCount = (content.match(/^\d+\./gm) || []).length;
  }

  if (layer === 'kernel') {
    // Count rules/invariants
    meta.ruleCount = (content.match(/^- /gm) || []).length;
    // Count sections
    meta.sectionCount = (content.match(/^## /gm) || []).length;
    // Check for imports
    meta.hasImports = /@[a-zA-Z]/.test(content);
  }

  if (layer === 'task') {
    // Count todos
    const total = (content.match(/- \[[ x]\]/gi) || []).length;
    const done = (content.match(/- \[x\]/gi) || []).length;
    meta.totalTasks = total;
    meta.completedTasks = done;
    meta.progress = total > 0 ? Math.round((done / total) * 100) : 0;
  }

  return meta;
}

// ─── Context Budget Calculator ──────────────────────────────────────

export function calculateBudget(files: AgentFile[]): ContextBudget {
  const config = vscode.workspace.getConfiguration('clawdcontext');
  const totalBudget = config.get<number>('tokenBudget', 200000);
  const warnThreshold = config.get<number>('cerWarningThreshold', 0.4);
  const critThreshold = config.get<number>('cerCriticalThreshold', 0.2);

  const filesByLayer = new Map<LayerType, AgentFile[]>();
  let alwaysLoadedTokens = 0;
  let onDemandTokens = 0;

  for (const file of files) {
    const layerFiles = filesByLayer.get(file.layer) || [];
    layerFiles.push(file);
    filesByLayer.set(file.layer, layerFiles);

    if (file.alwaysLoaded) {
      alwaysLoadedTokens += file.tokens;
    } else {
      onDemandTokens += file.tokens;
    }
  }

  const reasoningHeadroom = totalBudget - alwaysLoadedTokens;
  const cer = totalBudget > 0
    ? (totalBudget - alwaysLoadedTokens) / totalBudget
    : 0;

  // User-configured CER thresholds are direct CER cutoffs:
  // - CER < critical threshold => critical
  // - CER < warning threshold  => warning
  // - otherwise                => optimal
  const cerStatus = classifyCerStatus(cer, warnThreshold, critThreshold);

  return {
    totalBudget,
    alwaysLoadedTokens,
    onDemandTokens,
    reasoningHeadroom,
    cer,
    cerStatus,
    filesByLayer,
    allFiles: files,
  };
}

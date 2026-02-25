/**
 * AI Validator — Validates agent files using AI (mdcc compiler).
 *
 * Provides: single-file validation, workspace validation,
 * semantic contradiction detection, quality gates, AI-powered fixes.
 */

import * as vscode from 'vscode';
import { aiComplete } from './provider';
import type { AiCompletionResult } from './provider';
import { SYSTEM_PROMPT_VALIDATOR, SYSTEM_PROMPT_CONTRADICTION, SYSTEM_PROMPT_FIXER } from './prompts';
import type { AgentFile, ContextBudget } from '../analyzers/tokenAnalyzer';

// ─── Result Types ───────────────────────────────────────────────────

export interface Violation {
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number | null;
  message: string;
  fix: string;
}

export interface ValidationResult {
  file: string;
  layer: string;
  score: number;
  verdict: 'PASS' | 'WARN' | 'FAIL';
  violations: Violation[];
  suggestions: string[];
  estimatedTokens: number;
  aiModel: string;
  latencyMs: number;
}

export interface ContradictionResult {
  isContradiction: boolean;
  confidence: number;
  subject: string;
  explanation: string;
  resolution: string;
  fileA: string;
  lineA: number;
  fileB: string;
  lineB: number;
}

// ─── Quality Gates ──────────────────────────────────────────────────

export interface QualityGate {
  compositeScore: number;
  gate: 'PRODUCTION' | 'MANUAL_REVIEW' | 'REJECT';
}

export function computeQualityGate(score: number): QualityGate {
  const gate: QualityGate['gate'] =
    score >= 75 ? 'PRODUCTION' :
    score >= 60 ? 'MANUAL_REVIEW' :
    'REJECT';
  return { compositeScore: score, gate };
}

// ─── Validate Single File ───────────────────────────────────────────

export async function validateFile(file: AgentFile): Promise<ValidationResult> {
  const userMessage = `Validate this ${file.layer} file (${file.relativePath}):

\`\`\`markdown
${file.content.substring(0, 12000)}
\`\`\`

File stats:
- Estimated tokens: ${file.tokens}
- Layer: ${file.layer}
- Always loaded: ${file.alwaysLoaded}
${file.metadata ? `- Metadata: ${JSON.stringify(file.metadata)}` : ''}`;

  try {
    const response = await aiComplete({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_VALIDATOR },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      maxTokens: 2000,
    });
    return parseValidationResponse(response, file);
  } catch (e: any) {
    return {
      file: file.relativePath,
      layer: file.layer,
      score: 0,
      verdict: 'FAIL',
      violations: [{
        rule: 'AI_ERROR',
        severity: 'critical',
        line: null,
        message: `AI validation failed: ${e.message}`,
        fix: 'Check AI provider configuration and connectivity.',
      }],
      suggestions: [],
      estimatedTokens: file.tokens,
      aiModel: 'unknown',
      latencyMs: 0,
    };
  }
}

// ─── Validate Workspace ─────────────────────────────────────────────

export async function validateWorkspace(
  budget: ContextBudget,
  progress?: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const files = budget.allFiles;
  const step = files.length > 0 ? 100 / files.length : 100;

  for (let i = 0; i < files.length; i++) {
    progress?.report({
      message: `Validating ${files[i].relativePath}... (${i + 1}/${files.length})`,
      increment: step,
    });
    results.push(await validateFile(files[i]));
  }

  return results;
}

// ─── Detect Semantic Contradictions ─────────────────────────────────

export async function detectContradictions(
  budget: ContextBudget,
  progress?: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<ContradictionResult[]> {
  const results: ContradictionResult[] = [];
  const kernelFiles = budget.filesByLayer.get('kernel') || [];
  const learningFiles = budget.filesByLayer.get('learning') || [];

  if (kernelFiles.length === 0 || learningFiles.length === 0) { return results; }

  // Extract directive lines from kernel files
  const directivePattern = /\b(never|always|must|must not|do not|don't|should|prefer|avoid|require)\b/i;
  const kernelDirectives: Array<{ text: string; file: AgentFile; line: number }> = [];
  for (const file of kernelFiles) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (directivePattern.test(lines[i])) {
        kernelDirectives.push({ text: lines[i].trim(), file, line: i });
      }
    }
  }

  // Extract directive lines from lessons
  const lessonPattern = /\b(never|always|must|must not|do not|don't|should|prefer|avoid|require|learned|discovered)\b/i;
  const lessonDirectives: Array<{ text: string; file: AgentFile; line: number }> = [];
  for (const file of learningFiles) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lessonPattern.test(lines[i])) {
        lessonDirectives.push({ text: lines[i].trim(), file, line: i });
      }
    }
  }

  // Pre-filter: pairs that share 2+ keywords (before sending to AI)
  const pairsToCheck: Array<[typeof kernelDirectives[0], typeof lessonDirectives[0]]> = [];
  for (const kd of kernelDirectives) {
    const kWords = extractKeywords(kd.text);
    for (const ld of lessonDirectives) {
      const lWords = extractKeywords(ld.text);
      const shared = kWords.filter(w => lWords.includes(w)).length;
      if (shared >= 2) {
        pairsToCheck.push([kd, ld]);
      }
    }
  }

  // Limit AI calls to top 10 most likely contradictions
  const limited = pairsToCheck.slice(0, 10);
  const step = limited.length > 0 ? 100 / limited.length : 100;

  for (let i = 0; i < limited.length; i++) {
    const [kd, ld] = limited[i];
    progress?.report({
      message: `Checking contradiction ${i + 1}/${limited.length}...`,
      increment: step,
    });

    try {
      const userMessage = `Segment A (from ${kd.file.relativePath}, line ${kd.line + 1}):\n"${kd.text}"\n\nSegment B (from ${ld.file.relativePath}, line ${ld.line + 1}):\n"${ld.text}"`;

      const response = await aiComplete({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_CONTRADICTION },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        maxTokens: 500,
      });

      const parsed = parseJsonResponse(response.content);
      if (parsed && parsed.isContradiction && parsed.confidence > 0.6) {
        results.push({
          isContradiction: true,
          confidence: parsed.confidence,
          subject: parsed.subject || 'unknown',
          explanation: parsed.explanation || '',
          resolution: parsed.resolution || '',
          fileA: kd.file.relativePath,
          lineA: kd.line,
          fileB: ld.file.relativePath,
          lineB: ld.line,
        });
      }
    } catch {
      // Skip failed AI calls
    }
  }

  return results;
}

// ─── Fix File ───────────────────────────────────────────────────────

export async function fixFile(
  file: AgentFile,
  violations: Violation[],
): Promise<{ content: string; model: string; latencyMs: number }> {
  const violationsSummary = violations.map(v =>
    `- [${v.severity}] ${v.rule}: ${v.message} (fix: ${v.fix})`
  ).join('\n');

  const userMessage = `Fix this ${file.layer} file (${file.relativePath}).

Current content:
\`\`\`markdown
${file.content.substring(0, 12000)}
\`\`\`

Violations found:
${violationsSummary}

Fix all violations while preserving the user's intent. Return ONLY the fixed file content.`;

  const response = await aiComplete({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_FIXER },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    maxTokens: 4000,
  });

  return {
    content: cleanAIOutput(response.content),
    model: response.model,
    latencyMs: response.latencyMs || 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function parseValidationResponse(response: AiCompletionResult, file: AgentFile): ValidationResult {
  const parsed = parseJsonResponse(response.content);

  if (!parsed) {
    return {
      file: file.relativePath,
      layer: file.layer,
      score: 50,
      verdict: 'WARN',
      violations: [{
        rule: 'AI_PARSE_ERROR',
        severity: 'low',
        line: null,
        message: 'AI response was not valid JSON. Manual review recommended.',
        fix: 'Re-run validation or review manually.',
      }],
      suggestions: [response.content.substring(0, 200)],
      estimatedTokens: file.tokens,
      aiModel: response.model,
      latencyMs: response.latencyMs || 0,
    };
  }

  return {
    file: parsed.file || file.relativePath,
    layer: parsed.layer || file.layer,
    score: Math.min(100, Math.max(0, parsed.score || 0)),
    verdict: parsed.verdict || 'WARN',
    violations: (parsed.violations || []).map((v: any) => ({
      rule: v.rule || 'UNKNOWN',
      severity: v.severity || 'medium',
      line: v.line ?? null,
      message: v.message || '',
      fix: v.fix || '',
    })),
    suggestions: parsed.suggestions || [],
    estimatedTokens: parsed.estimatedTokens || file.tokens,
    aiModel: response.model,
    latencyMs: response.latencyMs || 0,
  };
}

function extractKeywords(text: string): string[] {
  const stopWords = ['always', 'never', 'must', 'should', 'avoid', 'prefer',
    'that', 'this', 'with', 'from', 'have', 'been', 'will', 'when', 'they'];
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.includes(w));
}

function parseJsonResponse(text: string): any {
  try { return JSON.parse(text); } catch {}
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) { try { return JSON.parse(jsonMatch[1]); } catch {} }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  return null;
}

function cleanAIOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned;
}

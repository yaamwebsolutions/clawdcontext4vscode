/**
 * AI Generator — Generates agent configuration files using AI.
 *
 * Provides: generate missing files, generate specific file,
 * generate SKILL.md from procedure, fix file from violations.
 */

import * as vscode from 'vscode';
import { aiComplete } from './provider';
import { SYSTEM_PROMPT_GENERATOR, SYSTEM_PROMPT_FIXER } from './prompts';
import type { ContextBudget, AgentFile } from '../analyzers/tokenAnalyzer';
import { estimateTokens } from '../analyzers/tokenAnalyzer';

// ─── Types ──────────────────────────────────────────────────────────

export type GenerateTarget = 'CLAUDE.md' | 'SKILL.md' | 'todo.md' | 'lessons.md' | 'AGENTS.md';

export interface GeneratedFile {
  path: string;
  content: string;
  isNew: boolean;
  tokens: number;
}

export interface GenerationResult {
  files: GeneratedFile[];
  aiModel: string;
  latencyMs: number;
}

// ─── Generate Missing Files ─────────────────────────────────────────

export async function generateMissing(
  budget: ContextBudget | null,
  progress?: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<GenerationResult> {
  const existingFiles = budget?.allFiles.map(f => f.relativePath) || [];
  const projectContext = await gatherProjectContext();

  // Determine what's missing
  const expected = ['CLAUDE.md', 'lessons.md', 'todo.md'];
  const missing = expected.filter(f =>
    !existingFiles.some(ef => ef.toLowerCase().endsWith(f.toLowerCase()))
  );

  if (missing.length === 0) {
    return { files: [], aiModel: 'n/a', latencyMs: 0 };
  }

  progress?.report({ message: `Generating ${missing.length} missing file(s)...` });

  const userMessage = `Generate the following missing agent configuration files for this project:

Missing files: ${missing.join(', ')}

Project context:
${projectContext}

${budget ? `Current workspace:
- Existing files: ${existingFiles.join(', ')}
- Token budget: ${budget.totalBudget}
- Current CER: ${(budget.cer * 100).toFixed(1)}% (${budget.cerStatus})
- Always loaded tokens: ${budget.alwaysLoadedTokens}
` : ''}

Remember:
- CLAUDE.md must be < 2000 tokens (minimal kernel)
- lessons.md starts with a header and governance schema comment
- todo.md should scaffold a blank task template
- Use the ---FILE: <name>--- / ---END--- format to separate files`;

  const response = await aiComplete({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_GENERATOR },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    maxTokens: 4000,
  });

  return {
    files: parseMultiFileResponse(response.content, missing),
    aiModel: response.model,
    latencyMs: response.latencyMs || 0,
  };
}

// ─── Generate Specific File ─────────────────────────────────────────

export async function generateFile(
  target: GenerateTarget,
  budget: ContextBudget | null,
  customInstructions?: string,
): Promise<GenerationResult> {
  const projectContext = await gatherProjectContext();
  const existingFiles = budget?.allFiles || [];

  const existing = existingFiles.find(f =>
    f.relativePath.toLowerCase().endsWith(target.toLowerCase())
  );

  const userMessage = `Generate a ${target} file for this project.

Project context:
${projectContext}

${existing ? `Current ${target} content (${existing.tokens} tokens):
\`\`\`markdown
${existing.content.substring(0, 6000)}
\`\`\`
` : `No ${target} exists yet.`}

${budget ? `Workspace state:
- Token budget: ${budget.totalBudget}
- CER: ${(budget.cer * 100).toFixed(1)}% (${budget.cerStatus})
- Files: ${budget.allFiles.map(f => f.relativePath).join(', ')}
` : ''}

${customInstructions ? `Custom instructions: ${customInstructions}` : ''}

Generate ONLY the file content. No explanations.`;

  const response = await aiComplete({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_GENERATOR },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    maxTokens: 4000,
  });

  const content = cleanOutput(response.content);
  return {
    files: [{
      path: target,
      content,
      isNew: !existing,
      tokens: estimateTokens(content),
    }],
    aiModel: response.model,
    latencyMs: response.latencyMs || 0,
  };
}

// ─── Fix File with Violations ───────────────────────────────────────

export async function fixFileFromViolations(
  file: AgentFile,
  violations: Array<{ rule: string; severity: string; message: string; fix: string }>,
): Promise<GenerationResult> {
  const violationText = violations.map(v =>
    `- [${v.severity}] ${v.rule}: ${v.message}\n  Fix: ${v.fix}`
  ).join('\n');

  const userMessage = `Fix this ${file.layer} file (${file.relativePath}).

Current content:
\`\`\`markdown
${file.content.substring(0, 12000)}
\`\`\`

Violations:
${violationText}

Fix all violations. If a fix requires creating a new file (e.g., extracting to SKILL.md), use the multi-file format.`;

  const response = await aiComplete({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_FIXER },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    maxTokens: 4000,
  });

  const files = parseMultiFileResponse(response.content, [file.relativePath]);

  // If no multi-file format detected, treat as single file fix
  if (files.length === 0) {
    const content = cleanOutput(response.content);
    files.push({
      path: file.relativePath,
      content,
      isNew: false,
      tokens: estimateTokens(content),
    });
  }

  return {
    files,
    aiModel: response.model,
    latencyMs: response.latencyMs || 0,
  };
}

// ─── Project Context Gathering ──────────────────────────────────────

async function gatherProjectContext(): Promise<string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) { return 'No workspace open.'; }

  const root = workspaceFolders[0].uri;
  const context: string[] = [];

  const checks = [
    { file: 'package.json', label: 'Node.js project' },
    { file: 'pyproject.toml', label: 'Python project' },
    { file: 'Cargo.toml', label: 'Rust project' },
    { file: 'go.mod', label: 'Go project' },
    { file: 'Dockerfile', label: 'Docker containerized' },
    { file: '.github/workflows', label: 'GitHub Actions CI/CD' },
    { file: 'tsconfig.json', label: 'TypeScript' },
    { file: '.claude/settings.json', label: 'Claude Code configured' },
  ];

  for (const check of checks) {
    try {
      const uri = vscode.Uri.joinPath(root, check.file);
      await vscode.workspace.fs.stat(uri);
      context.push(`- ${check.label} (${check.file} found)`);

      if (check.file === 'package.json') {
        try {
          const raw = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
          const pkg = JSON.parse(raw);
          if (pkg.name) { context.push(`  Project name: ${pkg.name}`); }
          if (pkg.description) { context.push(`  Description: ${pkg.description}`); }
        } catch {}
      }
    } catch {
      // File doesn't exist
    }
  }

  // Top-level directories
  try {
    const entries = await vscode.workspace.fs.readDirectory(root);
    const dirs = entries
      .filter(([, type]) => type === vscode.FileType.Directory)
      .map(([name]) => name)
      .filter(n => !n.startsWith('.') && n !== 'node_modules' && n !== '__pycache__')
      .slice(0, 15);
    if (dirs.length > 0) {
      context.push(`- Top-level directories: ${dirs.join(', ')}`);
    }
  } catch {}

  return context.length > 0 ? context.join('\n') : 'Minimal project — no standard config files detected.';
}

// ─── Parse Multi-File Response ──────────────────────────────────────

function parseMultiFileResponse(
  content: string,
  expectedFiles: string[],
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Try multi-file format: ---FILE: name--- ... ---END---
  const filePattern = /---FILE:\s*(.+?)---\s*\n([\s\S]*?)---END---/g;
  let match;

  while ((match = filePattern.exec(content)) !== null) {
    const fileContent = match[2].trim();
    files.push({
      path: match[1].trim(),
      content: fileContent,
      isNew: true,
      tokens: estimateTokens(fileContent),
    });
  }

  // If no multi-file format, try to split by file headers
  if (files.length === 0 && expectedFiles.length > 1) {
    for (const expected of expectedFiles) {
      const headerPattern = new RegExp(
        `#\\s*${expected.replace('.', '\\.')}[\\s\\S]*?(?=(?:#\\s*[A-Z][\\w.]+\\.md)|$)`, 'i'
      );
      const m = content.match(headerPattern);
      if (m) {
        const fileContent = m[0].trim();
        files.push({
          path: expected,
          content: fileContent,
          isNew: true,
          tokens: estimateTokens(fileContent),
        });
      }
    }
  }

  return files;
}

// ─── Helper ─────────────────────────────────────────────────────────

function cleanOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned;
}

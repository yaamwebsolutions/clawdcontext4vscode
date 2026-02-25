import * as vscode from 'vscode';
import type { AgentFile, ContextBudget} from './tokenAnalyzer';
import { analyzePositionalAttention } from './tokenAnalyzer';
import type { SecurityReport } from './securityScanner';
import { scanAllSkills } from './securityScanner';

// ─── Diagnostic Collection ──────────────────────────────────────────

const DIAGNOSTIC_SOURCE = 'ClawdContext';

export function createDiagnosticCollection(): vscode.DiagnosticCollection {
  return vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
}

// ─── Lint Result for Dashboard ──────────────────────────────────────

export interface LintResult {
  securityReports: SecurityReport[];
  positionalWarnings: number;
}

// ─── Run All Lints ──────────────────────────────────────────────────

export function lintAllFiles(
  budget: ContextBudget,
  collection: vscode.DiagnosticCollection
): LintResult {
  collection.clear();
  const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();

  const addDiag = (uri: vscode.Uri, diag: vscode.Diagnostic) => {
    const key = uri.toString();
    const arr = diagnosticsByUri.get(key) || [];
    arr.push(diag);
    diagnosticsByUri.set(key, arr);
  };

  // 1. Context budget warnings
  lintContextBudget(budget, addDiag);

  // 2. Kernel (CLAUDE.md) lint
  for (const file of budget.filesByLayer.get('kernel') || []) {
    lintKernelFile(file, addDiag);
  }

  // 3. Lessons governance
  for (const file of budget.filesByLayer.get('learning') || []) {
    lintLessonsFile(file, addDiag);
  }

  // 4. Skill lint
  for (const file of budget.filesByLayer.get('skill') || []) {
    lintSkillFile(file, addDiag);
  }

  // 5. Cross-file contradiction detection
  lintContradictions(budget, addDiag);

  // 6. Positional analysis (Lost-in-the-Middle)
  let positionalWarnings = 0;
  for (const file of budget.allFiles.filter(f => f.alwaysLoaded)) {
    positionalWarnings += lintPositionalAttention(file, addDiag);
  }

  // 7. Security scanning for SKILL.md files
  const securityReports = scanAllSkills(budget.allFiles, addDiag);

  // Apply all diagnostics
  for (const [uriStr, diags] of diagnosticsByUri) {
    collection.set(vscode.Uri.parse(uriStr), diags);
  }

  return { securityReports, positionalWarnings };
}

// ─── Context Budget Lint ────────────────────────────────────────────

function lintContextBudget(
  budget: ContextBudget,
  addDiag: (uri: vscode.Uri, diag: vscode.Diagnostic) => void
): void {
  // Warn if always-loaded files consume too much
  if (budget.cerStatus === 'critical') {
    for (const file of budget.allFiles.filter(f => f.alwaysLoaded)) {
      const range = new vscode.Range(0, 0, 0, 0);
      const diag = new vscode.Diagnostic(
        range,
        `⚡ Context heat death: always-loaded files consume ${Math.round((1 - budget.cer) * 100)}% of context budget. ` +
        `CER = ${budget.cer.toFixed(2)} (critical < 0.3). ` +
        `This file contributes ${file.tokens} tokens.`,
        vscode.DiagnosticSeverity.Error
      );
      diag.source = DIAGNOSTIC_SOURCE;
      diag.code = 'CER_CRITICAL';
      addDiag(file.uri, diag);
    }
  } else if (budget.cerStatus === 'warning') {
    for (const file of budget.allFiles.filter(f => f.alwaysLoaded && f.tokens > 2000)) {
      const range = new vscode.Range(0, 0, 0, 0);
      const diag = new vscode.Diagnostic(
        range,
        `⚠️ Context pressure: CER = ${budget.cer.toFixed(2)} (warning < 0.6). ` +
        `This file contributes ${file.tokens} tokens. Consider moving procedures to SKILL.md.`,
        vscode.DiagnosticSeverity.Warning
      );
      diag.source = DIAGNOSTIC_SOURCE;
      diag.code = 'CER_WARNING';
      addDiag(file.uri, diag);
    }
  }
}

// ─── Kernel (CLAUDE.md) Lint ────────────────────────────────────────

function lintKernelFile(
  file: AgentFile,
  addDiag: (uri: vscode.Uri, diag: vscode.Diagnostic) => void
): void {
  const lines = file.content.split('\n');

  // Warn if too large (> 3000 tokens)
  if (file.tokens > 3000) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      `Kernel bloat: ${file.relativePath} is ${file.tokens} tokens. ` +
      `Recommended: < 2000 tokens for always-loaded files. ` +
      `Move procedures to SKILL.md and local rules to lessons.md.`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = 'KERNEL_BLOAT';
    addDiag(file.uri, diag);
  }

  // Detect procedure-like content in kernel (should be in SKILL.md)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Long numbered step sequences suggest a procedure
    if (/^\d+\.\s/.test(line)) {
      let stepCount = 0;
      let j = i;
      while (j < lines.length && /^\d+\.\s/.test(lines[j])) {
        stepCount++;
        j++;
      }
      if (stepCount >= 5) {
        const diag = new vscode.Diagnostic(
          new vscode.Range(i, 0, i + stepCount - 1, lines[i + stepCount - 1]?.length || 0),
          `Procedure detected in kernel file (${stepCount} steps). ` +
          `Move to a SKILL.md for on-demand loading and better CER.`,
          vscode.DiagnosticSeverity.Information
        );
        diag.source = DIAGNOSTIC_SOURCE;
        diag.code = 'PROCEDURE_IN_KERNEL';
        addDiag(file.uri, diag);
        break;
      }
    }

    // Detect local/temporal heuristics in kernel
    if (/(?:temporary|hack|workaround|until|for now|TODO)/i.test(line)) {
      const diag = new vscode.Diagnostic(
        new vscode.Range(i, 0, i, line.length),
        `Temporal/local heuristic in kernel file. ` +
        `Kernel should contain only permanent invariants. Move to lessons.md.`,
        vscode.DiagnosticSeverity.Information
      );
      diag.source = DIAGNOSTIC_SOURCE;
      diag.code = 'HEURISTIC_IN_KERNEL';
      addDiag(file.uri, diag);
    }
  }
}

// ─── Lessons Governance Lint ────────────────────────────────────────

function lintLessonsFile(
  file: AgentFile,
  addDiag: (uri: vscode.Uri, diag: vscode.Diagnostic) => void
): void {
  const config = vscode.workspace.getConfiguration('clawdcontext');
  const ttlDays = config.get<number>('lessonsTtlDays', 60);
  const maxEntries = config.get<number>('lessonsMaxEntries', 50);
  const lines = file.content.split('\n');
  const now = new Date();

  // Check entry count (Kessler syndrome warning)
  if (file.metadata.entryCount > maxEntries) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      `🛸 Kessler syndrome risk: ${file.metadata.entryCount} entries (max recommended: ${maxEntries}). ` +
      `Too many rules create instruction collisions. Prune stale entries.`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = 'KESSLER_RISK';
    addDiag(file.uri, diag);
  }

  // Check for stale entries (integral windup)
  for (let i = 0; i < lines.length; i++) {
    const dateMatch = lines[i].match(/^## (\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const entryDate = new Date(dateMatch[1]);
      const ageDays = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

      if (ageDays > ttlDays) {
        // Check if it's a local-heuristic (most likely to go stale)
        let isLocalHeuristic = false;
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          if (/type:\s*local-heuristic/i.test(lines[j])) {
            isLocalHeuristic = true;
            break;
          }
        }

        if (isLocalHeuristic) {
          const diag = new vscode.Diagnostic(
            new vscode.Range(i, 0, i, lines[i].length),
            `⏰ Stale local-heuristic: ${ageDays} days old (TTL: ${ttlDays}d). ` +
            `Review for archival or promotion. Integral windup risk.`,
            vscode.DiagnosticSeverity.Warning
          );
          diag.source = DIAGNOSTIC_SOURCE;
          diag.code = 'STALE_LESSON';
          addDiag(file.uri, diag);
        }
      }
    }

    // Check for missing metadata fields
    if (/^## \d{4}-\d{2}-\d{2}/.test(lines[i])) {
      const entryBlock = lines.slice(i, Math.min(i + 20, lines.length)).join('\n');
      const requiredFields = ['Scope', 'Type', 'Confidence', 'Source', 'Status'];
      const missingFields = requiredFields.filter(
        f => !new RegExp(`\\*\\*${f}:\\*\\*|${f}:`, 'i').test(entryBlock) &&
             !new RegExp(`- ${f}:`, 'i').test(entryBlock)
      );

      if (missingFields.length > 0) {
        const diag = new vscode.Diagnostic(
          new vscode.Range(i, 0, i, lines[i].length),
          `Missing governance metadata: ${missingFields.join(', ')}. ` +
          `Add for proper lesson lifecycle management.`,
          vscode.DiagnosticSeverity.Information
        );
        diag.source = DIAGNOSTIC_SOURCE;
        diag.code = 'MISSING_METADATA';
        addDiag(file.uri, diag);
      }
    }
  }

  // Check for deprecated entries still in file
  if (file.metadata.deprecated > 0) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      `${file.metadata.deprecated} deprecated entries still in file. Archive to lessons.archive.md.`,
      vscode.DiagnosticSeverity.Information
    );
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = 'DEPRECATED_PRESENT';
    addDiag(file.uri, diag);
  }
}

// ─── Skill Lint ─────────────────────────────────────────────────────

function lintSkillFile(
  file: AgentFile,
  addDiag: (uri: vscode.Uri, diag: vscode.Diagnostic) => void
): void {
  // Check for missing frontmatter
  if (!file.content.startsWith('---')) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      `SKILL.md missing YAML frontmatter (---). Add name and description for proper skill indexing.`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = 'SKILL_NO_FRONTMATTER';
    addDiag(file.uri, diag);
  }

  // Warn if skill is too large (> 5000 tokens = cognitive overhead)
  if (file.tokens > 5000) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      `Skill too large: ${file.tokens} tokens. SkillsBench research shows focused skills (2-3 modules) outperform comprehensive docs. Consider splitting.`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = 'SKILL_TOO_LARGE';
    addDiag(file.uri, diag);
  }
}

// ─── Cross-File Contradiction Detection ─────────────────────────────

function lintContradictions(
  budget: ContextBudget,
  addDiag: (uri: vscode.Uri, diag: vscode.Diagnostic) => void
): void {
  const kernelFiles = budget.filesByLayer.get('kernel') || [];
  const learningFiles = budget.filesByLayer.get('learning') || [];

  // Simple pattern-based contradiction detection
  // Extract "never/always/must/must not" rules from kernel
  const kernelRules: Array<{ pattern: string; line: number; file: AgentFile }> = [];

  for (const file of kernelFiles) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (/\b(never|always|must not|must|do not|don't)\b/.test(line)) {
        kernelRules.push({ pattern: line.trim(), line: i, file });
      }
    }
  }

  // Check if lessons contradict kernel rules
  for (const lFile of learningFiles) {
    const lLines = lFile.content.split('\n');
    for (let i = 0; i < lLines.length; i++) {
      const lLine = lLines[i].toLowerCase();
      for (const rule of kernelRules) {
        // Naive contradiction: same subject, opposite directive
        if (hasContradictionSignal(rule.pattern, lLine)) {
          const diag = new vscode.Diagnostic(
            new vscode.Range(i, 0, i, lLines[i].length),
            `⚡ Potential contradiction with ${rule.file.relativePath}:${rule.line + 1}. ` +
            `Three-body problem: conflicting instructions from kernel and learning layers. ` +
            `Kernel takes precedence (Layer 1 > Layer 4).`,
            vscode.DiagnosticSeverity.Warning
          );
          diag.source = DIAGNOSTIC_SOURCE;
          diag.code = 'CONTRADICTION';
          diag.relatedInformation = [
            new vscode.DiagnosticRelatedInformation(
              new vscode.Location(rule.file.uri, new vscode.Range(rule.line, 0, rule.line, 100)),
              `Kernel rule: ${rule.pattern.substring(0, 80)}`
            ),
          ];
          addDiag(lFile.uri, diag);
        }
      }
    }
  }
}

function hasContradictionSignal(ruleA: string, ruleB: string): boolean {
  // Extract key subject words (nouns)
  const extractSubjects = (text: string) =>
    text.replace(/\b(never|always|must|must not|do not|don't|should|should not|avoid|prefer)\b/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 5);

  const subjectsA = extractSubjects(ruleA);
  const subjectsB = extractSubjects(ruleB);

  // Need at least 2 shared subject words
  const sharedCount = subjectsA.filter(s => subjectsB.includes(s)).length;
  if (sharedCount < 2) { return false; }

  // Check for opposite directives
  const positiveA = /\b(always|must|prefer|should)\b/.test(ruleA) && !/\b(not|never|don't)\b/.test(ruleA);
  const negativeA = /\b(never|must not|do not|don't|avoid)\b/.test(ruleA);
  const positiveB = /\b(always|must|prefer|should)\b/.test(ruleB) && !/\b(not|never|don't)\b/.test(ruleB);
  const negativeB = /\b(never|must not|do not|don't|avoid)\b/.test(ruleB);

  return (positiveA && negativeB) || (negativeA && positiveB);
}

// ─── Positional Analysis (Lost-in-the-Middle) ──────────────────────

function lintPositionalAttention(
  file: AgentFile,
  addDiag: (uri: vscode.Uri, diag: vscode.Diagnostic) => void
): number {
  const zones = analyzePositionalAttention(file.content);
  if (zones.length === 0) { return 0; }

  const middleZone = zones.find(z => z.zone === 'middle');
  if (!middleZone || middleZone.criticalInstructions.length === 0) { return 0; }

  let warnings = 0;

  // Flag critical instructions buried in the dead zone
  for (const instr of middleZone.criticalInstructions) {
    const lines = file.content.split('\n');
    const lineText = lines[instr.line] || '';

    const diag = new vscode.Diagnostic(
      new vscode.Range(instr.line, 0, instr.line, lineText.length),
      `📍 Lost-in-the-Middle: critical ${instr.keyword} buried in dead zone (lines ${middleZone.startLine + 1}–${middleZone.endLine + 1}). ` +
      `Stanford research: middle-positioned info gets ~55% attention vs. 75% at start. ` +
      `Move to the first or last third of the file for better agent compliance.`,
      vscode.DiagnosticSeverity.Information
    );
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = 'LOST_IN_MIDDLE';
    addDiag(file.uri, diag);
    warnings++;
  }

  // Summary diagnostic if many critical instructions in dead zone
  if (middleZone.criticalInstructions.length >= 3) {
    const diag = new vscode.Diagnostic(
      new vscode.Range(middleZone.startLine, 0, middleZone.startLine, 0),
      `🔴 ${middleZone.criticalInstructions.length} critical instructions in attention dead zone. ` +
      `Agent may ignore ${(middleZone.criticalInstructions.length * 0.2).toFixed(0)}+ instructions due to positional attention decay. ` +
      `Restructure file to place security/prohibition rules at start or end.`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = DIAGNOSTIC_SOURCE;
    diag.code = 'DEAD_ZONE_CLUSTER';
    addDiag(file.uri, diag);
    warnings++;
  }

  return warnings;
}

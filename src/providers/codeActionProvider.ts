import * as vscode from 'vscode';
import * as path from 'path';

const DIAGNOSTIC_SOURCE = 'ClawdContext';

export class ClawdContextCodeActionProvider implements vscode.CodeActionProvider {

  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== DIAGNOSTIC_SOURCE && diag.source !== 'ClawdContext Security') {
        continue;
      }

      switch (diag.code) {
        case 'PROCEDURE_IN_KERNEL':
          actions.push(this.extractProcedureToSkill(document, diag));
          break;

        case 'HEURISTIC_IN_KERNEL':
          actions.push(this.moveToLessons(document, diag));
          break;

        case 'MISSING_METADATA':
          actions.push(this.addGovernanceMetadata(document, diag));
          break;

        case 'STALE_LESSON':
          actions.push(this.markDeprecated(document, diag));
          actions.push(this.markPromotionCandidate(document, diag));
          break;

        case 'DEPRECATED_PRESENT':
          actions.push(this.archiveDeprecated(document, diag));
          break;

        case 'SKILL_NO_FRONTMATTER':
          actions.push(this.addSkillFrontmatter(document, diag));
          break;

        case 'KERNEL_BLOAT':
          actions.push(this.createBloatReport(document, diag));
          break;

        case 'KESSLER_RISK':
          actions.push(this.createPruneCommand(document, diag));
          break;
      }
    }

    return actions;
  }

  // ─── Extract Procedure → SKILL.md ─────────────────────────────

  private extractProcedureToSkill(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '📘 Extract procedure to SKILL.md (on-demand loading)',
      vscode.CodeActionKind.Refactor,
    );
    action.diagnostics = [diag];
    action.isPreferred = true;

    action.command = {
      command: 'clawdcontext.extractProcedure',
      title: 'Extract Procedure to SKILL.md',
      arguments: [document.uri, diag.range],
    };

    return action;
  }

  // ─── Move Heuristic → lessons.md ──────────────────────────────

  private moveToLessons(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '🧠 Move temporal heuristic to lessons.md',
      vscode.CodeActionKind.Refactor,
    );
    action.diagnostics = [diag];

    action.command = {
      command: 'clawdcontext.moveToLessons',
      title: 'Move to lessons.md',
      arguments: [document.uri, diag.range],
    };

    return action;
  }

  // ─── Add Governance Metadata ──────────────────────────────────

  private addGovernanceMetadata(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '📋 Add governance metadata (scope, type, confidence, source, status)',
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diag];
    action.isPreferred = true;

    // Parse which fields are missing from the diagnostic message
    const missingMatch = diag.message.match(/Missing governance metadata:\s*(.+?)\./);
    const missingFields = missingMatch
      ? missingMatch[1].split(', ').map(f => f.trim())
      : ['Scope', 'Type', 'Confidence', 'Source', 'Status'];

    // Find the insertion point — after the ## heading and any immediate content
    const headingLine = diag.range.start.line;
    let insertLine = headingLine + 1;

    // Skip past any content until we find a blank line or another heading
    while (insertLine < document.lineCount) {
      const line = document.lineAt(insertLine).text;
      if (line.trim() === '' || /^## /.test(line)) { break; }
      insertLine++;
    }

    const edit = new vscode.WorkspaceEdit();
    const metadataLines: string[] = [];

    if (missingFields.includes('Scope')) {
      metadataLines.push('- **Scope:** local');
    }
    if (missingFields.includes('Type')) {
      metadataLines.push('- **Type:** local-heuristic');
    }
    if (missingFields.includes('Confidence')) {
      metadataLines.push('- **Confidence:** med');
    }
    if (missingFields.includes('Source')) {
      metadataLines.push('- **Source:** manual observation');
    }
    if (missingFields.includes('Status')) {
      metadataLines.push('- **Status:** proposed');
    }

    const insertPos = new vscode.Position(insertLine, 0);
    edit.insert(document.uri, insertPos, metadataLines.join('\n') + '\n');
    action.edit = edit;

    return action;
  }

  // ─── Mark Entry as Deprecated ─────────────────────────────────

  private markDeprecated(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '🗑️ Mark as deprecated',
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diag];

    const headingLine = diag.range.start.line;
    let insertLine = headingLine + 1;

    // Find where to insert status
    while (insertLine < document.lineCount) {
      const line = document.lineAt(insertLine).text;
      if (/status:/i.test(line)) {
        // Replace existing status
        const edit = new vscode.WorkspaceEdit();
        const statusRange = new vscode.Range(insertLine, 0, insertLine, line.length);
        edit.replace(document.uri, statusRange, '- **Status:** deprecated');
        action.edit = edit;
        return action;
      }
      if (line.trim() === '' || /^## /.test(line)) { break; }
      insertLine++;
    }

    // Insert new status
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(insertLine, 0), '- **Status:** deprecated\n');
    action.edit = edit;
    return action;
  }

  // ─── Mark as Promotion Candidate ──────────────────────────────

  private markPromotionCandidate(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '⬆️ Mark as promotion candidate (→ CLAUDE.md)',
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diag];

    const headingLine = diag.range.start.line;
    let insertLine = headingLine + 1;

    while (insertLine < document.lineCount) {
      const line = document.lineAt(insertLine).text;
      if (line.trim() === '' || /^## /.test(line)) { break; }
      insertLine++;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(insertLine, 0), '- **Promotion candidate:** yes\n');
    action.edit = edit;
    return action;
  }

  // ─── Archive Deprecated Entries ───────────────────────────────

  private archiveDeprecated(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '📦 Archive deprecated entries to lessons.archive.md',
      vscode.CodeActionKind.Refactor,
    );
    action.diagnostics = [diag];

    action.command = {
      command: 'clawdcontext.archiveDeprecated',
      title: 'Archive Deprecated Entries',
      arguments: [document.uri],
    };

    return action;
  }

  // ─── Add SKILL.md Frontmatter ─────────────────────────────────

  private addSkillFrontmatter(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '📘 Add YAML frontmatter (name + description)',
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diag];
    action.isPreferred = true;

    const skillName = path.basename(path.dirname(document.uri.fsPath));
    const edit = new vscode.WorkspaceEdit();
    edit.insert(
      document.uri,
      new vscode.Position(0, 0),
      `---\nname: ${skillName}\ndescription: <describe what this skill does>\n---\n\n`
    );
    action.edit = edit;
    return action;
  }

  // ─── Kernel Bloat Report ──────────────────────────────────────

  private createBloatReport(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '📊 Analyze sections for extraction candidates',
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diag];

    action.command = {
      command: 'clawdcontext.analyzeBloat',
      title: 'Analyze Kernel Bloat',
      arguments: [document.uri],
    };

    return action;
  }

  // ─── Quick Prune Command ──────────────────────────────────────

  private createPruneCommand(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      '🗑️ Open stale lesson pruner',
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diag];

    action.command = {
      command: 'clawdcontext.pruneLessons',
      title: 'Prune Stale Lessons',
    };

    return action;
  }
}

// ─── Command: Extract Procedure ─────────────────────────────────────

export async function extractProcedureCommand(
  sourceUri: vscode.Uri,
  range: vscode.Range,
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(sourceUri);
  const lines: string[] = [];

  // Collect the procedure lines
  let startLine = range.start.line;
  let endLine = range.end.line;

  // Expand to include the full section
  // Look backwards for a heading
  let sectionTitle = 'extracted-procedure';
  for (let i = startLine - 1; i >= 0; i--) {
    const line = doc.lineAt(i).text;
    if (/^##?\s+/.test(line)) {
      sectionTitle = line.replace(/^##?\s+/, '').trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      startLine = i;
      break;
    }
  }

  // Look forward for end
  for (let i = endLine + 1; i < doc.lineCount; i++) {
    const line = doc.lineAt(i).text;
    if (/^##?\s+/.test(line) || line.trim() === '') {
      endLine = i - 1;
      break;
    }
    endLine = i;
  }

  // Extract content
  for (let i = startLine; i <= endLine; i++) {
    lines.push(doc.lineAt(i).text);
  }

  const content = lines.join('\n');

  // Prompt for skill name
  const skillName = await vscode.window.showInputBox({
    prompt: 'Skill name for the extracted procedure',
    value: sectionTitle,
    placeHolder: 'e.g., deploy-checklist, api-migration',
  });

  if (!skillName) { return; }

  // Create the SKILL.md
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) { return; }

  const skillDir = vscode.Uri.joinPath(workspaceFolder.uri, 'skills', skillName);
  const skillUri = vscode.Uri.joinPath(skillDir, 'SKILL.md');

  const skillContent = `---
name: ${skillName}
description: Extracted from ${vscode.workspace.asRelativePath(sourceUri)}
---

${content}
`;

  try {
    await vscode.workspace.fs.createDirectory(skillDir);
  } catch { /* may exist */ }

  await vscode.workspace.fs.writeFile(skillUri, Buffer.from(skillContent, 'utf8'));

  // Replace in source with a reference
  const edit = new vscode.WorkspaceEdit();
  const replaceRange = new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length);
  edit.replace(sourceUri, replaceRange,
    `<!-- Procedure extracted to skills/${skillName}/SKILL.md by ClawdContext -->\n` +
    `<!-- Use: @${skillName} to invoke on demand -->`
  );
  await vscode.workspace.applyEdit(edit);

  // Open the new skill file
  const newDoc = await vscode.workspace.openTextDocument(skillUri);
  await vscode.window.showTextDocument(newDoc, vscode.ViewColumn.Beside);

  vscode.window.showInformationMessage(
    `Extracted procedure to skills/${skillName}/SKILL.md. CER improved by moving ${lines.length} lines from always-loaded kernel.`
  );
}

// ─── Command: Move Heuristic to Lessons ─────────────────────────────

export async function moveToLessonsCommand(
  sourceUri: vscode.Uri,
  range: vscode.Range,
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(sourceUri);
  const line = doc.lineAt(range.start.line).text;
  const today = new Date().toISOString().split('T')[0];

  // Find or create lessons.md
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) { return; }

  const lessonsUri = vscode.Uri.joinPath(workspaceFolder.uri, 'lessons.md');

  const lessonEntry = `\n## ${today} — Moved from kernel: ${line.trim().substring(0, 50)}

${line.trim()}

- **Scope:** local
- **Type:** local-heuristic
- **Confidence:** med
- **Source:** extracted from ${vscode.workspace.asRelativePath(sourceUri)}
- **Status:** proposed
`;

  try {
    const existingContent = Buffer.from(await vscode.workspace.fs.readFile(lessonsUri)).toString('utf8');
    await vscode.workspace.fs.writeFile(lessonsUri, Buffer.from(existingContent + lessonEntry, 'utf8'));
  } catch {
    // Create new lessons.md
    const header = `# Lessons Learned\n\n<!-- ClawdContext governed lessons file -->\n`;
    await vscode.workspace.fs.writeFile(lessonsUri, Buffer.from(header + lessonEntry, 'utf8'));
  }

  // Remove from source
  const edit = new vscode.WorkspaceEdit();
  const lineRange = new vscode.Range(range.start.line, 0, range.start.line + 1, 0);
  edit.replace(sourceUri, lineRange, `<!-- Moved to lessons.md by ClawdContext -->\n`);
  await vscode.workspace.applyEdit(edit);

  vscode.window.showInformationMessage('Heuristic moved to lessons.md with governance metadata.');
}

// ─── Command: Archive Deprecated ────────────────────────────────────

export async function archiveDeprecatedCommand(
  sourceUri: vscode.Uri,
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(sourceUri);
  const content = doc.getText();
  const lines = content.split('\n');

  const archiveEntries: string[] = [];
  const keepLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^## \d{4}-\d{2}-\d{2}/.test(lines[i])) {
      // Check if this entry is deprecated
      const blockEnd = findEntryEnd(lines, i);
      const block = lines.slice(i, blockEnd).join('\n');

      if (/status:\s*deprecated/i.test(block)) {
        archiveEntries.push(block);
        i = blockEnd - 1; // Skip this entry
        continue;
      }
    }
    keepLines.push(lines[i]);
  }

  if (archiveEntries.length === 0) {
    vscode.window.showInformationMessage('No deprecated entries found to archive.');
    return;
  }

  // Write archive file
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) { return; }

  const archiveUri = vscode.Uri.joinPath(workspaceFolder.uri, 'lessons.archive.md');
  const archiveHeader = `# Lessons Archive\n\n<!-- Deprecated entries moved by ClawdContext -->\n<!-- Date archived: ${new Date().toISOString().split('T')[0]} -->\n\n`;

  try {
    const existing = Buffer.from(await vscode.workspace.fs.readFile(archiveUri)).toString('utf8');
    await vscode.workspace.fs.writeFile(
      archiveUri,
      Buffer.from(existing + '\n' + archiveEntries.join('\n\n'), 'utf8')
    );
  } catch {
    await vscode.workspace.fs.writeFile(
      archiveUri,
      Buffer.from(archiveHeader + archiveEntries.join('\n\n'), 'utf8')
    );
  }

  // Rewrite source without deprecated entries
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(0, 0, doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length);
  edit.replace(sourceUri, fullRange, keepLines.join('\n'));
  await vscode.workspace.applyEdit(edit);

  vscode.window.showInformationMessage(
    `Archived ${archiveEntries.length} deprecated entries to lessons.archive.md.`
  );
}

// ─── Command: Analyze Bloat ─────────────────────────────────────────

export async function analyzeBloatCommand(sourceUri: vscode.Uri): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(sourceUri);
  const content = doc.getText();
  const lines = content.split('\n');

  // Find sections and their token costs
  interface Section {
    title: string;
    startLine: number;
    tokens: number;
    isProcedure: boolean;
    isHeuristic: boolean;
  }

  const { estimateTokens } = await import('../analyzers/tokenAnalyzer');

  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let sectionContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##?\s+/.test(line)) {
      // Save previous section
      if (currentSection) {
        currentSection.tokens = estimateTokens(sectionContent.join('\n'));
        currentSection.isProcedure = sectionContent.some(l => /^\d+\.\s/.test(l));
        currentSection.isHeuristic = sectionContent.some(l =>
          /(?:temporary|hack|workaround|until|for now|TODO)/i.test(l)
        );
        sections.push(currentSection);
      }
      currentSection = { title: line.replace(/^##?\s+/, ''), startLine: i, tokens: 0, isProcedure: false, isHeuristic: false };
      sectionContent = [];
    } else {
      sectionContent.push(line);
    }
  }
  if (currentSection) {
    currentSection.tokens = estimateTokens(sectionContent.join('\n'));
    currentSection.isProcedure = sectionContent.some(l => /^\d+\.\s/.test(l));
    currentSection.isHeuristic = sectionContent.some(l =>
      /(?:temporary|hack|workaround|until|for now|TODO)/i.test(l)
    );
    sections.push(currentSection);
  }

  // Sort by token cost, descending
  sections.sort((a, b) => b.tokens - a.tokens);

  // Show as quick pick
  const picks = sections.map(s => ({
    label: `${s.isProcedure ? '📘' : s.isHeuristic ? '🧠' : '📄'} ${s.title}`,
    description: `${s.tokens} tokens${s.isProcedure ? ' — extractable to SKILL.md' : ''}${s.isHeuristic ? ' — move to lessons.md' : ''}`,
    detail: `Line ${s.startLine + 1} · ${((s.tokens / estimateTokens(content)) * 100).toFixed(0)}% of file`,
    section: s,
  }));

  const picked = await vscode.window.showQuickPick(picks, {
    title: 'ClawdContext: Kernel Bloat Analysis — Largest Sections',
    placeHolder: 'Select a section to navigate to it',
  });

  if (picked) {
    const editor = await vscode.window.showTextDocument(doc);
    const pos = new vscode.Position(picked.section.startLine, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos));
  }
}

// ─── Helper ─────────────────────────────────────────────────────────

function findEntryEnd(lines: string[], startIdx: number): number {
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## \d{4}-\d{2}-\d{2}/.test(lines[i])) { return i; }
  }
  return lines.length;
}

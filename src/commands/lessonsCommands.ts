import * as vscode from 'vscode';
import { state, analyzeWorkspace } from './analyzeWorkspace';

/**
 * Prune stale lessons entries.
 * Finds local-heuristic entries older than TTL and lets the user
 * pick which ones to deprecate.
 */
export async function pruneLessons(): Promise<void> {
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const learningFiles = state.budget.filesByLayer.get('learning') || [];
  if (learningFiles.length === 0) {
    vscode.window.showInformationMessage('No lessons.md found.');
    return;
  }

  const config = vscode.workspace.getConfiguration('clawdcontext');
  const ttlDays = config.get<number>('lessonsTtlDays', 60);
  const now = new Date();
  let foundStale = false;

  for (const file of learningFiles) {
    const lines = file.content.split('\n');
    const stale: Array<{ startLine: number; title: string; ageDays: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^## (\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)/);
      if (m) {
        const age = Math.floor(
          (now.getTime() - new Date(m[1]).getTime()) / 86400000,
        );
        const block = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
        if (age > ttlDays && /type:\s*local-heuristic/i.test(block)) {
          stale.push({ startLine: i, title: m[2] || 'Untitled', ageDays: age });
        }
      }
    }

    if (stale.length === 0) {
      continue; // Check remaining files instead of returning early
    }

    foundStale = true;

    const picks = await vscode.window.showQuickPick(
      stale.map(e => ({
        label: e.title,
        description: `${e.ageDays}d old`,
        detail: `Line ${e.startLine + 1}`,
      })),
      {
        canPickMany: true,
        title: `${stale.length} stale lessons`,
        placeHolder: 'Select to deprecate',
      },
    );

    if (picks && picks.length > 0) {
      await vscode.window.showTextDocument(
        await vscode.workspace.openTextDocument(file.uri),
      );
      vscode.window.showInformationMessage(
        `Selected ${picks.length}. Use the quick-fix lightbulb to mark deprecated.`,
      );
    }
  }

  if (!foundStale) {
    vscode.window.showInformationMessage('No stale entries found. All lessons are current!');
  }
}

/**
 * Review promotion candidates in lessons.md.
 */
export async function promoteLessons(): Promise<void> {
  if (!state.budget) { await analyzeWorkspace(); }
  if (!state.budget) { return; }

  const learningFiles = state.budget.filesByLayer.get('learning') || [];
  let total = 0;
  for (const f of learningFiles) {
    total += f.metadata.promotionCandidates || 0;
  }

  if (total === 0) {
    vscode.window.showInformationMessage('No promotion candidates.');
    return;
  }

  vscode.window.showInformationMessage(
    `${total} promotion candidate(s). Review and promote validated lessons to CLAUDE.md.`,
  );

  if (learningFiles.length > 0) {
    await vscode.window.showTextDocument(
      await vscode.workspace.openTextDocument(learningFiles[0].uri),
    );
  }
}

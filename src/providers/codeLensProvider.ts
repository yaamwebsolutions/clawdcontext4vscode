import * as vscode from 'vscode';

export class LessonsCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const config = vscode.workspace.getConfiguration('clawdcontext');
    if (!config.get<boolean>('enableCodeLens', true)) { return []; }

    const name = document.fileName.toLowerCase();
    if (!name.endsWith('lessons.md') && !name.endsWith('lessons-learned.md')) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    const now = new Date();
    const ttlDays = config.get<number>('lessonsTtlDays', 60);

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text;
      const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)/);

      if (dateMatch) {
        const entryDate = new Date(dateMatch[1]);
        const ageDays = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
        const range = new vscode.Range(i, 0, i, line.length);

        // Age indicator
        let ageLabel: string;
        let ageIcon: string;
        if (ageDays <= 7) {
          ageIcon = '🟢';
          ageLabel = `${ageIcon} ${ageDays}d old — Fresh`;
        } else if (ageDays <= 30) {
          ageIcon = '🟡';
          ageLabel = `${ageIcon} ${ageDays}d old — Active`;
        } else if (ageDays <= ttlDays) {
          ageIcon = '🟠';
          ageLabel = `${ageIcon} ${ageDays}d old — Aging (TTL: ${ttlDays}d)`;
        } else {
          ageIcon = '🔴';
          ageLabel = `${ageIcon} ${ageDays}d old — STALE (TTL: ${ttlDays}d exceeded)`;
        }

        lenses.push(new vscode.CodeLens(range, {
          title: ageLabel,
          command: '',
          arguments: [],
        }));

        // Extract type from next few lines
        const blockLines = [];
        for (let j = i + 1; j < Math.min(i + 8, document.lineCount); j++) {
          blockLines.push(document.lineAt(j).text);
        }
        const block = blockLines.join('\n');

        const typeMatch = block.match(/type:\s*(\S+)/i);
        const confidenceMatch = block.match(/confidence:\s*(\S+)/i);
        const statusMatch = block.match(/status:\s*(\S+)/i);
        const promotionMatch = block.match(/promotion.candidate:\s*(\S+)/i);

        const tags: string[] = [];
        if (typeMatch) { tags.push(`type:${typeMatch[1]}`); }
        if (confidenceMatch) { tags.push(`conf:${confidenceMatch[1]}`); }
        if (statusMatch) { tags.push(`status:${statusMatch[1]}`); }
        if (promotionMatch && promotionMatch[1].toLowerCase() === 'yes') {
          tags.push('⬆️ PROMOTE');
        }

        if (tags.length > 0) {
          lenses.push(new vscode.CodeLens(range, {
            title: tags.join(' · '),
            command: '',
            arguments: [],
          }));
        }
      }
    }

    return lenses;
  }
}

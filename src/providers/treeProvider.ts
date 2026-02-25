import * as vscode from 'vscode';
import type { ContextBudget, LayerType, AgentFile } from '../analyzers/tokenAnalyzer';

// ─── Layer Definitions ──────────────────────────────────────────────

const LAYER_META: Record<LayerType, { label: string; icon: string; description: string; order: number }> = {
  hook:      { label: 'Hooks',           icon: 'shield',       description: 'Deterministic enforcement', order: 0 },
  kernel:    { label: 'CLAUDE.md',       icon: 'symbol-key',   description: 'Global invariants',         order: 1 },
  skill:     { label: 'SKILL.md',        icon: 'book',         description: 'Procedural knowledge',      order: 2 },
  task:      { label: 'todo.md',         icon: 'checklist',    description: 'Task state',                order: 3 },
  learning:  { label: 'lessons.md',      icon: 'mortar-board', description: 'Post-correction learning',  order: 4 },
  subagent:  { label: 'Subagents',       icon: 'split-horizontal', description: 'Context partitioning',  order: 5 },
  unknown:   { label: 'Other',           icon: 'file',         description: 'Unclassified',              order: 6 },
};

// ─── Tree Items ─────────────────────────────────────────────────────

export class LayerTreeItem extends vscode.TreeItem {
  constructor(
    public readonly layerType: LayerType,
    public readonly files: AgentFile[],
    public readonly totalTokens: number,
  ) {
    const meta = LAYER_META[layerType];
    super(meta.label, files.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
    this.description = `${files.length} files · ${totalTokens.toLocaleString()} tokens`;
    this.tooltip = `${meta.description}\n${files.length} files · ${totalTokens.toLocaleString()} tokens`;
    this.iconPath = new vscode.ThemeIcon(meta.icon);
    this.contextValue = 'layer';
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(public readonly file: AgentFile) {
    super(file.relativePath, vscode.TreeItemCollapsibleState.None);

    this.description = `${file.tokens.toLocaleString()} tok${file.alwaysLoaded ? ' · ⚡ always' : ''}`;
    this.tooltip = buildFileTooltip(file);
    this.resourceUri = file.uri;
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [file.uri],
    };

    // Set icon based on layer
    this.iconPath = new vscode.ThemeIcon(
      file.alwaysLoaded ? 'zap' : 'file',
      file.alwaysLoaded ? new vscode.ThemeColor('clawdcontext.cerWarning') : undefined
    );
    this.contextValue = 'agentFile';
  }
}

function buildFileTooltip(file: AgentFile): string {
  const parts = [
    `📄 ${file.relativePath}`,
    `Layer: ${LAYER_META[file.layer].label}`,
    `Tokens: ${file.tokens.toLocaleString()}`,
    `Context: ${file.alwaysLoaded ? 'Always loaded (boot)' : 'On-demand'}`,
  ];

  if (file.layer === 'learning' && file.metadata.entryCount) {
    parts.push(`Entries: ${file.metadata.entryCount}`);
    if (file.metadata.localHeuristics) { parts.push(`Local heuristics: ${file.metadata.localHeuristics}`); }
    if (file.metadata.promotionCandidates) { parts.push(`Promotion candidates: ${file.metadata.promotionCandidates}`); }
  }

  if (file.layer === 'skill' && file.metadata.skillName) {
    parts.push(`Skill: ${file.metadata.skillName}`);
    if (file.metadata.stepCount) { parts.push(`Steps: ${file.metadata.stepCount}`); }
  }

  if (file.layer === 'task' && file.metadata.totalTasks) {
    parts.push(`Progress: ${file.metadata.completedTasks}/${file.metadata.totalTasks} (${file.metadata.progress}%)`);
  }

  return parts.join('\n');
}

// ─── Layers Tree Provider ───────────────────────────────────────────

export class LayersTreeProvider implements vscode.TreeDataProvider<LayerTreeItem | FileTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<LayerTreeItem | FileTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private budget: ContextBudget | null = null;

  refresh(budget: ContextBudget): void {
    this.budget = budget;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: LayerTreeItem | FileTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LayerTreeItem | FileTreeItem): (LayerTreeItem | FileTreeItem)[] {
    if (!this.budget) { return []; }

    if (!element) {
      // Root: return layers sorted by order
      const layers: LayerTreeItem[] = [];
      const allTypes: LayerType[] = ['hook', 'kernel', 'skill', 'task', 'learning', 'subagent'];

      for (const layerType of allTypes) {
        const files = this.budget.filesByLayer.get(layerType) || [];
        const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);
        if (files.length > 0) {
          layers.push(new LayerTreeItem(layerType, files, totalTokens));
        }
      }
      return layers;
    }

    if (element instanceof LayerTreeItem) {
      return element.files.map(f => new FileTreeItem(f));
    }

    return [];
  }
}

// ─── Health Tree Provider ───────────────────────────────────────────

export class HealthTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string, icon: string, color?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(icon, color ? new vscode.ThemeColor(color) : undefined);
  }
}

export class HealthTreeProvider implements vscode.TreeDataProvider<HealthTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HealthTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private budget: ContextBudget | null = null;

  refresh(budget: ContextBudget): void {
    this.budget = budget;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: HealthTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HealthTreeItem[] {
    if (!this.budget) { return []; }
    const b = this.budget;

    const cerIcon = b.cerStatus === 'optimal' ? 'pass' : b.cerStatus === 'warning' ? 'warning' : 'error';
    const cerColor = b.cerStatus === 'optimal' ? 'clawdcontext.cerOptimal'
                   : b.cerStatus === 'warning' ? 'clawdcontext.cerWarning'
                   : 'clawdcontext.cerCritical';

    return [
      new HealthTreeItem(
        'CER',
        `${(b.cer * 100).toFixed(1)}% — ${b.cerStatus}`,
        cerIcon,
        cerColor
      ),
      new HealthTreeItem(
        'Token Budget',
        `${b.totalBudget.toLocaleString()} tokens`,
        'symbol-ruler'
      ),
      new HealthTreeItem(
        'Always Loaded',
        `${b.alwaysLoadedTokens.toLocaleString()} tokens (${((b.alwaysLoadedTokens / b.totalBudget) * 100).toFixed(1)}%)`,
        'zap',
        b.alwaysLoadedTokens > b.totalBudget * 0.3 ? 'clawdcontext.cerWarning' : undefined
      ),
      new HealthTreeItem(
        'On-Demand',
        `${b.onDemandTokens.toLocaleString()} tokens available`,
        'library'
      ),
      new HealthTreeItem(
        'Reasoning Headroom',
        `${b.reasoningHeadroom.toLocaleString()} tokens`,
        'lightbulb',
        b.reasoningHeadroom < b.totalBudget * 0.5 ? 'clawdcontext.cerWarning' : 'clawdcontext.cerOptimal'
      ),
      new HealthTreeItem(
        'Total Files',
        `${b.allFiles.length} agent files detected`,
        'files'
      ),
    ];
  }
}

// ─── Lessons Governance Tree Provider ───────────────────────────────

export class LessonsTreeProvider implements vscode.TreeDataProvider<HealthTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HealthTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private budget: ContextBudget | null = null;

  refresh(budget: ContextBudget): void {
    this.budget = budget;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: HealthTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HealthTreeItem[] {
    if (!this.budget) { return []; }
    const learningFiles = this.budget.filesByLayer.get('learning') || [];
    if (learningFiles.length === 0) {
      return [new HealthTreeItem('No lessons.md found', 'Create one to track learnings', 'info')];
    }

    const items: HealthTreeItem[] = [];
    const config = vscode.workspace.getConfiguration('clawdcontext');
    const maxEntries = config.get<number>('lessonsMaxEntries', 50);

    for (const file of learningFiles) {
      const m = file.metadata;
      const count = m.entryCount || 0;
      const isOverloaded = count > maxEntries;

      items.push(new HealthTreeItem(
        'Total Entries',
        `${count}${isOverloaded ? ` ⚠️ (max: ${maxEntries})` : ''}`,
        isOverloaded ? 'warning' : 'check',
        isOverloaded ? 'clawdcontext.cerWarning' : 'clawdcontext.cerOptimal'
      ));

      if (m.localHeuristics !== undefined) {
        items.push(new HealthTreeItem('Local Heuristics', `${m.localHeuristics}`, 'clock'));
      }
      if (m.globalInvariants !== undefined) {
        items.push(new HealthTreeItem('Global Invariants', `${m.globalInvariants}`, 'shield'));
      }
      if (m.promotionCandidates > 0) {
        items.push(new HealthTreeItem(
          'Promotion Candidates',
          `${m.promotionCandidates} ready for review`,
          'arrow-up',
          'clawdcontext.cerOptimal'
        ));
      }
      if (m.deprecated > 0) {
        items.push(new HealthTreeItem(
          'Deprecated',
          `${m.deprecated} — archive these`,
          'trash',
          'clawdcontext.cerWarning'
        ));
      }

      items.push(new HealthTreeItem(
        'Token Cost',
        `${file.tokens.toLocaleString()} tokens`,
        'symbol-ruler'
      ));
    }

    return items;
  }
}

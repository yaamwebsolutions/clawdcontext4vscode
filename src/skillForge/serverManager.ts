/**
 * Skill Forge Studio — Server Manager.
 *
 * Manages the SFS Python backend lifecycle:
 * - Auto-discovers skill_forge_studio/ in the workspace
 * - Spawns the backend via run.sh or direct Python invocation
 * - Monitors health and provides status via output channel
 * - Kills the server on extension deactivation
 */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { SfsClient } from './sfsClient';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export class SfsServerManager implements vscode.Disposable {
  private process: cp.ChildProcess | null = null;
  private outputChannel: vscode.OutputChannel;
  private statusBarItem: vscode.StatusBarItem;
  private client: SfsClient;
  private _status: ServerStatus = 'stopped';
  private healthPollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(client: SfsClient) {
    this.client = client;
    this.outputChannel = vscode.window.createOutputChannel('Skill Forge Studio');
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    this.statusBarItem.command = 'clawdcontext.skillForgeToggleServer';
    this.updateStatusBar();
  }

  get status(): ServerStatus { return this._status; }

  /** Find the skill_forge_studio directory in the workspace. */
  findSfsRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) { return undefined; }

    for (const folder of folders) {
      // Direct match: workspace IS skill_forge_studio
      const mainPy = path.join(folder.uri.fsPath, 'backend', 'main.py');
      if (fs.existsSync(mainPy)) { return folder.uri.fsPath; }

      // Nested: workspace contains skill_forge_studio/
      const nested = path.join(folder.uri.fsPath, 'skill_forge_studio', 'backend', 'main.py');
      if (fs.existsSync(nested)) {
        return path.join(folder.uri.fsPath, 'skill_forge_studio');
      }
    }
    return undefined;
  }

  /** Start the SFS backend server. */
  async start(): Promise<boolean> {
    if (this._status === 'running' || this._status === 'starting') {
      return this._status === 'running';
    }

    const sfsRoot = this.findSfsRoot();
    if (!sfsRoot) {
      this.outputChannel.appendLine('[SFS] skill_forge_studio/ not found in workspace');
      this.setStatus('error');
      return false;
    }

    // Check if already running
    if (await this.client.isAvailable()) {
      this.outputChannel.appendLine('[SFS] Backend already running');
      this.setStatus('running');
      this.startHealthPoll();
      return true;
    }

    this.setStatus('starting');
    this.outputChannel.appendLine(`[SFS] Starting backend from ${sfsRoot}...`);
    this.outputChannel.show(true);

    // Find Python interpreter
    const pythonPath = this.findPython(sfsRoot);
    if (!pythonPath) {
      const setupCmd = process.platform === 'win32' ? '.\\run.ps1' : './run.sh';
      this.outputChannel.appendLine(`[SFS] No Python venv found. Run: cd skill_forge_studio && ${setupCmd}`);
      this.setStatus('error');
      vscode.window.showWarningMessage(
        `Skill Forge: No Python venv found. Run ${setupCmd} in skill_forge_studio/ first.`,
        'Open Terminal',
      ).then(choice => {
        if (choice === 'Open Terminal') {
          const terminal = vscode.window.createTerminal({ name: 'Skill Forge Setup', cwd: sfsRoot });
          terminal.show();
          terminal.sendText(setupCmd);
        }
      });
      return false;
    }

    this.outputChannel.appendLine(`[SFS] Using Python: ${pythonPath}`);

    // Spawn uvicorn
    try {
      this.process = cp.spawn(pythonPath, [
        '-m', 'uvicorn', 'backend.main:app',
        '--host', '0.0.0.0', '--port', '8742',
      ], {
        cwd: sfsRoot,
        env: { ...process.env, PYTHONPATH: sfsRoot },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.outputChannel.appendLine(data.toString().trim());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        this.outputChannel.appendLine(text);
        // Uvicorn logs "Uvicorn running on..." to stderr
        if (text.includes('Uvicorn running on') || text.includes('Application startup complete')) {
          this.setStatus('running');
          this.startHealthPoll();
        }
      });

      this.process.on('exit', (code) => {
        this.outputChannel.appendLine(`[SFS] Backend exited with code ${code}`);
        this.setStatus('stopped');
        this.process = null;
        this.stopHealthPoll();
      });

      this.process.on('error', (err) => {
        this.outputChannel.appendLine(`[SFS] Failed to start: ${err.message}`);
        this.setStatus('error');
        this.process = null;
      });

      // Wait for the server to respond
      const ready = await this.waitForHealthy(15000);
      if (ready) {
        this.outputChannel.appendLine('[SFS] Backend is ready');
        this.setStatus('running');
        this.startHealthPoll();
        return true;
      } else {
        this.outputChannel.appendLine('[SFS] Backend did not become healthy in time');
        this.setStatus('error');
        return false;
      }
    } catch (err) {
      this.outputChannel.appendLine(`[SFS] Spawn error: ${err}`);
      this.setStatus('error');
      return false;
    }
  }

  /** Stop the SFS backend server. */
  stop(): void {
    this.stopHealthPoll();
    if (this.process && this.process.pid) {
      this.outputChannel.appendLine('[SFS] Stopping backend...');
      if (process.platform === 'win32') {
        // Windows: use taskkill for reliable process tree termination
        cp.exec(`taskkill /pid ${this.process.pid} /T /F`, () => { /* best-effort */ });
      } else {
        this.process.kill('SIGTERM');
      }
      // Force kill after 5s
      const proc = this.process;
      setTimeout(() => {
        try { proc.kill(); } catch { /* already dead */ }
        if (this.process === proc) { this.process = null; }
      }, 5000);
    }
    this.setStatus('stopped');
  }

  dispose(): void {
    this.stop();
    this.outputChannel.dispose();
    this.statusBarItem.dispose();
  }

  // ─── Private helpers ──────────────────────────────────────

  private findPython(sfsRoot: string): string | undefined {
    // Build OS-appropriate candidate list (avoid checking paths that can't exist)
    const isWin = process.platform === 'win32';
    const candidates: string[] = isWin
      ? [
          path.join(sfsRoot, 'venv', 'Scripts', 'python.exe'),
          path.join(sfsRoot, '.venv', 'Scripts', 'python.exe'),
        ]
      : [
          path.join(sfsRoot, 'venv', 'bin', 'python'),
          path.join(sfsRoot, 'venv', 'bin', 'python3'),
          path.join(sfsRoot, '.venv', 'bin', 'python'),
          path.join(sfsRoot, '.venv', 'bin', 'python3'),
        ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) { return candidate; }
    }

    return undefined;
  }

  private async waitForHealthy(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    const interval = 500;
    while (Date.now() - start < timeoutMs) {
      if (await this.client.isAvailable()) { return true; }
      await new Promise(r => setTimeout(r, interval));
    }
    return false;
  }

  private startHealthPoll(): void {
    this.stopHealthPoll();
    this.healthPollTimer = setInterval(async () => {
      if (!(await this.client.isAvailable())) {
        this.outputChannel.appendLine('[SFS] Backend became unreachable');
        this.setStatus('error');
        this.stopHealthPoll();
      }
    }, 30000); // Check every 30s
  }

  private stopHealthPoll(): void {
    if (this.healthPollTimer) {
      clearInterval(this.healthPollTimer);
      this.healthPollTimer = null;
    }
  }

  private setStatus(status: ServerStatus): void {
    this._status = status;
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const icons: Record<ServerStatus, string> = {
      stopped: '$(circle-outline)',
      starting: '$(loading~spin)',
      running: '$(circle-filled)',
      error: '$(error)',
    };
    const colors: Record<ServerStatus, string | undefined> = {
      stopped: undefined,
      starting: undefined,
      running: '#059669',
      error: '#DC2626',
    };
    this.statusBarItem.text = `${icons[this._status]} Skill Forge`;
    this.statusBarItem.tooltip = `Skill Forge Studio: ${this._status}`;
    this.statusBarItem.color = colors[this._status];
    this.statusBarItem.show();
  }
}

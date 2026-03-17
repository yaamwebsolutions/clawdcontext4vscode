import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const isWin = process.platform === 'win32';

const REPO_URL = 'https://github.com/ClawdContextOS/starter-stack.git';
const INSTALL_SCRIPT_URL = 'https://raw.githubusercontent.com/ClawdContextOS/starter-stack/main/install.sh';

/**
 * ClawdContext OS: Initialize OS Workspace
 *
 * One-click bridge from VS Code extension (Layer 1) to full ClawdContext OS.
 * Downloads starter-stack, runs setup, opens the new workspace.
 */
export async function initializeOSWorkspace(): Promise<void> {
  // Step 1: Choose installation method
  const method = await vscode.window.showQuickPick(
    [
      {
        label: '$(rocket) Quick Start — Clone starter-stack',
        description: 'Git clone + make setup (recommended)',
        detail: 'Clones the ClawdContextOS/starter-stack repo with full security stack, then runs setup.',
        id: 'clone',
      },
      {
        label: '$(terminal) Install Script — curl | bash',
        description: 'Guided installation with boot sequence',
        detail: 'Downloads and runs the installer with ASCII boot animation and guided prompts.',
        id: 'script',
      },
      {
        label: '$(file-directory) Open Existing',
        description: 'Open a previously initialized OS workspace',
        detail: 'Select an existing ClawdContext OS workspace folder.',
        id: 'open',
      },
    ],
    {
      title: 'ClawdContext OS — Initialize Security Platform',
      placeHolder: 'Choose installation method',
    },
  );

  if (!method) {
    return;
  }

  const methodId = (method as { id: string }).id;

  switch (methodId) {
    case 'clone':
      await cloneStarterStack();
      break;
    case 'script':
      await runInstallScript();
      break;
    case 'open':
      await openExistingWorkspace();
      break;
  }
}

/**
 * Clone the starter-stack repo and run setup.
 */
async function cloneStarterStack(): Promise<void> {
  // Ask where to clone
  const targetDir = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Clone Here',
    title: 'Select parent directory for ClawdContext OS',
  });

  if (!targetDir || targetDir.length === 0) {
    return;
  }

  const parentPath = targetDir[0].fsPath;
  const osPath = path.join(parentPath, 'starter-stack');

  // Check if directory already exists
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(osPath));
    const action = await vscode.window.showWarningMessage(
      'starter-stack directory already exists. Open it instead?',
      'Open', 'Delete & Re-clone', 'Cancel',
    );
    if (action === 'Open') {
      await openWorkspaceAt(osPath);
      return;
    } else if (action === 'Delete & Re-clone') {
      // Remove existing
      await vscode.workspace.fs.delete(vscode.Uri.file(osPath), { recursive: true, useTrash: true });
    } else {
      return;
    }
  } catch {
    // Directory doesn't exist — good
  }

  // Clone with progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'ClawdContext OS',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Cloning starter-stack...' });

      try {
        await execFileAsync('git', ['clone', REPO_URL], { cwd: parentPath, timeout: 120000 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Clone failed: ${message}`);
        return;
      }

      progress.report({ message: 'Running setup...' });

      try {
        await execFileAsync('make', ['setup'], { cwd: osPath, timeout: 60000 });
      } catch {
        // make might not be available — make tools executable on Unix
        if (!isWin) {
          try {
            await execFileAsync('chmod', ['+x', ...findToolScripts(osPath)], { cwd: osPath, timeout: 5000 });
          } catch {
            // Tools might already be executable or no tools/ dir
          }
        }
      }

      progress.report({ message: 'Running initial security scan...' });

      try {
        const scanScript = path.join(osPath, 'tools', 'ccos-scan');
        if (isWin) {
          // On Windows try python or node to run the script, or skip
          await execFileAsync('python', [scanScript, 'agent'], { cwd: osPath, timeout: 30000 });
        } else {
          await execFileAsync('bash', [scanScript, 'agent'], { cwd: osPath, timeout: 30000 });
        }
      } catch {
        // Scan might find issues in _malicious (expected) or script not available
      }

      // Check if Docker is available for platform services
      let hasDocker = false;
      try {
        await execFileAsync('docker', ['compose', 'version'], { timeout: 5000 });
        hasDocker = true;
      } catch {
        // Docker not available
      }

      if (hasDocker) {
        progress.report({ message: 'Building platform services (AgentProxy, Scanner, FlightRecorder, Dashboard)...' });

        try {
          await execFileAsync(
            'docker', ['compose', '-f', 'docker-compose.platform.yml', 'build'],
            { cwd: osPath, timeout: 300000 },
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showWarningMessage(`Docker build warning: ${message}`);
        }

        progress.report({ message: 'Starting ClawdContext OS platform...' });

        try {
          await execFileAsync(
            'docker', ['compose', '-f', 'docker-compose.platform.yml', 'up', '-d'],
            { cwd: osPath, timeout: 60000 },
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showWarningMessage(`Docker start warning: ${message}`);
        }
      }

      progress.report({ message: 'Opening workspace...' });

      await openWorkspaceAt(osPath);

      if (hasDocker) {
        const action = await vscode.window.showInformationMessage(
          'ClawdContext OS is running! Dashboard at http://localhost:3000',
          'Open Dashboard', 'Show Status', 'Later',
        );

        if (action === 'Open Dashboard') {
          vscode.env.openExternal(vscode.Uri.parse('http://localhost:3000'));
        } else if (action === 'Show Status') {
          const terminal = vscode.window.createTerminal({
            name: 'ClawdContext OS',
            cwd: osPath,
          });
          terminal.show();
          terminal.sendText('docker compose -f docker-compose.platform.yml ps');
        }
      } else {
        vscode.window.showInformationMessage(
          'ClawdContext OS workspace initialized! Install Docker to enable the full platform (AgentProxy, Scanner, FlightRecorder, Dashboard).',
        );
      }
    },
  );
}

/**
 * Run the install script in an integrated terminal.
 * On Unix: curl | bash. On Windows: PowerShell Invoke-WebRequest.
 */
async function runInstallScript(): Promise<void> {
  // Check if curl is available (cross-platform)
  const curlCheckCmd = isWin ? 'where' : 'which';
  try {
    await execFileAsync(curlCheckCmd, ['curl']);
  } catch {
    vscode.window.showErrorMessage(
      'curl is required for the install script. Please install curl or use the Quick Start method.',
    );
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: 'ClawdContext OS — Installer',
    iconPath: new vscode.ThemeIcon('shield'),
  });
  terminal.show();

  if (isWin) {
    // PowerShell: download and execute
    terminal.sendText(
      `Invoke-WebRequest -Uri '${INSTALL_SCRIPT_URL}' -OutFile '$env:TEMP\\ccos-install.sh'; bash '$env:TEMP\\ccos-install.sh'`,
    );
  } else {
    terminal.sendText(`curl -fsSL ${INSTALL_SCRIPT_URL} | bash`);
  }

  vscode.window.showInformationMessage(
    'ClawdContext OS installer running in terminal. Follow the prompts to complete setup.',
  );
}

/**
 * Open an existing ClawdContext OS workspace.
 */
async function openExistingWorkspace(): Promise<void> {
  const selectedDir = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Open OS Workspace',
    title: 'Select ClawdContext OS workspace',
  });

  if (!selectedDir || selectedDir.length === 0) {
    return;
  }

  const osPath = selectedDir[0].fsPath;

  // Validate it looks like a starter-stack workspace
  try {
    await vscode.workspace.fs.stat(
      vscode.Uri.file(path.join(osPath, 'agent', 'CLAUDE.md')),
    );
  } catch {
    const proceed = await vscode.window.showWarningMessage(
      'This directory doesn\'t look like a ClawdContext OS workspace (missing agent/CLAUDE.md). Open anyway?',
      'Open', 'Cancel',
    );
    if (proceed !== 'Open') {
      return;
    }
  }

  await openWorkspaceAt(osPath);
}

/**
 * Open folder in VS Code (new window).
 */
async function openWorkspaceAt(folderPath: string): Promise<void> {
  const uri = vscode.Uri.file(folderPath);
  await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
}

/**
 * Quick status check for ClawdContext OS in current workspace.
 * Shows Layer 1-6 status + Docker service health when run from an OS workspace.
 */
export async function showOSStatus(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  const checks = [
    { layer: 'Layer 1 — Scanner', file: 'tools/ccos-scan' },
    { layer: 'Layer 2 — ClawdSign', file: 'tools/ccos-sign' },
    { layer: 'Layer 3 — Sandbox', file: 'security/sandbox/seccomp-strict.json' },
    { layer: 'Layer 4 — AgentProxy', file: 'platform/agent-proxy/main.py' },
    { layer: 'Layer 5 — FlightRecorder', file: 'platform/flight-recorder/main.py' },
    { layer: 'Layer 6 — SnapshotEngine', file: 'security/policies/sandbox.rego' },
  ];

  const lines: string[] = [
    '╔══════════════════════════════════════════╗',
    '║   ClawdContext OS — System Status        ║',
    '╠══════════════════════════════════════════╣',
  ];

  for (const check of checks) {
    try {
      await vscode.workspace.fs.stat(
        vscode.Uri.file(path.join(rootPath, check.file)),
      );
      lines.push(`║  ✓ ${check.layer.padEnd(34)}║`);
    } catch {
      lines.push(`║  ✗ ${check.layer.padEnd(34)}║`);
    }
  }

  // Check Docker services
  lines.push('╠══════════════════════════════════════════╣');
  lines.push('║   Docker Services                        ║');
  lines.push('╠══════════════════════════════════════════╣');

  try {
    const { stdout } = await execFileAsync(
      'docker', ['compose', '-f', 'docker-compose.platform.yml', 'ps', '--format', '{{.Name}} {{.Status}}'],
      { cwd: rootPath, timeout: 10000 },
    );

    const serviceLines = stdout.trim().split('\n').filter(l => l.trim());
    if (serviceLines.length === 0) {
      lines.push('║  — No containers running                ║');
    }
    for (const line of serviceLines) {
      const isUp = line.toLowerCase().includes('up');
      const icon = isUp ? '●' : '○';
      const truncated = line.slice(0, 34).padEnd(34);
      lines.push(`║  ${icon} ${truncated}║`);
    }
  } catch {
    lines.push('║  — Docker not available                 ║');
  }

  lines.push('╠══════════════════════════════════════════╣');
  lines.push('║  Dashboard:  http://localhost:3000       ║');
  lines.push('║  Proxy:      http://localhost:8400       ║');
  lines.push('║  Scanner:    http://localhost:8401       ║');
  lines.push('║  Recorder:   http://localhost:8402       ║');
  lines.push('╚══════════════════════════════════════════╝');

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join('\n'),
    language: 'plaintext',
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

/**
 * List files in tools/ directory for chmod +x (avoids shell glob expansion).
 */
function findToolScripts(osPath: string): string[] {
  const toolsDir = path.join(osPath, 'tools');
  try {
    return fs.readdirSync(toolsDir).map(f => path.join('tools', f));
  } catch {
    return [];
  }
}

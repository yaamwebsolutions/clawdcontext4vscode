import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Archetype definitions — distilled from 16 Anthropic production skills
// ---------------------------------------------------------------------------

interface Archetype {
  id: string;
  name: string;
  tier: string;
  icon: string;
  color: string;
  desc: string;
  structure: string;
  example: string;
}

const ARCHETYPES: Archetype[] = [
  { id: 'A', name: 'Pure Philosophy', tier: '1', icon: '✦', color: '#788c5d', desc: 'Single SKILL.md — changes how the agent thinks, not what tools it uses.', structure: 'SKILL.md (40-100 lines)', example: 'frontend-design, brand-guidelines' },
  { id: 'B', name: 'Dispatcher + Templates', tier: '1-2', icon: '⎔', color: '#2d8b8b', desc: 'Thin router delegating to specialized template files.', structure: 'SKILL.md + templates/', example: 'internal-comms, theme-factory' },
  { id: 'C', name: 'Routing Hub + References', tier: '3-4', icon: '◈', color: '#d4a03c', desc: 'Routes to deep reference docs per domain/framework.', structure: 'SKILL.md + references/', example: 'pptx, mcp-builder' },
  { id: 'D', name: 'Scripts Library', tier: '3-4', icon: '⚙', color: '#d97757', desc: 'SKILL.md paired with purpose-built scripts.', structure: 'SKILL.md + scripts/', example: 'xlsx, pdf, slack-gif-creator' },
  { id: 'E', name: 'Two-Phase Creative', tier: '3', icon: '◉', color: '#b06898', desc: 'Philosophy manifesto followed by code/visual expression.', structure: 'SKILL.md + canvas.js', example: 'algorithmic-art, canvas-design' },
  { id: 'F', name: 'Scaffold Pipeline', tier: '3', icon: '▥', color: '#6a9bcc', desc: 'Shell scripts scaffold and bundle entire projects.', structure: 'SKILL.md + scripts/*.sh', example: 'web-artifacts-builder' },
  { id: 'G', name: 'Full Lifecycle', tier: '4-5', icon: '◆', color: '#c0392b', desc: 'Multi-env, subagents, eval harnesses — the most complex.', structure: 'SKILL.md + refs/ + scripts/ + agents/', example: 'skill-creator, docx' },
];

// ---------------------------------------------------------------------------
// SKILL.md templates — one per archetype
// ---------------------------------------------------------------------------

const SKILL_TEMPLATES: Record<string, string> = {
  A: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Core Philosophy

{{philosophy}}

## Anti-Patterns — What to NEVER Do

- **{{anti_pattern_1}}**: {{why_bad_1}}
- **{{anti_pattern_2}}**: {{why_bad_2}}

## Examples

### Good
{{good_example}}

### Bad
{{bad_example}}
`,
  B: `---
name: {{name}}
description: "{{description}}. Trigger when user mentions {{triggers}}."
---

# {{title}}

Route to the appropriate template based on user intent:

| Intent | Template |
|--------|----------|
| {{intent_1}} | templates/{{template_1}}.md |
| {{intent_2}} | templates/{{template_2}}.md |
| {{intent_3}} | templates/{{template_3}}.md |

## Routing Rules

1. Ask the user what type of output they need
2. Load the matching template
3. Fill in the template using the user's input

## Default Behavior

If the user's intent is unclear, ask a clarifying question.
`,
  C: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Overview

{{overview}}

## Framework Router

| Framework / Domain | Reference |
|--------------------|-----------|
| {{framework_1}} | references/{{ref_1}}.md |
| {{framework_2}} | references/{{ref_2}}.md |

## Workflow

1. Identify the user's framework/domain
2. Load the matching reference doc
3. Apply framework-specific patterns
4. Validate output against reference
`,
  D: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Overview

{{overview}}

## Available Scripts

| Script | Purpose |
|--------|---------|
| scripts/{{script_1}} | {{purpose_1}} |
| scripts/{{script_2}} | {{purpose_2}} |

## Workflow

1. Understand the user's file/data requirements
2. Select the appropriate script
3. Run with the user's parameters
4. Validate the output
`,
  E: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Phase 1 — Philosophy

{{philosophy}}

### Core Principles
- {{principle_1}}
- {{principle_2}}

### Aesthetic Direction
{{aesthetic}}

## Phase 2 — Expression

Generate the artifact following the philosophy above.

### Technical Requirements
- {{tech_req_1}}
- {{tech_req_2}}
`,
  F: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Overview

{{overview}}

## Scaffolding Pipeline

### Step 1: Initialize
Run \`scripts/init.sh\` to create the project structure.

### Step 2: Configure
Apply user preferences to the generated scaffold.

### Step 3: Build & Bundle
Run \`scripts/build.sh\` to bundle the final output.

## Generated Structure

\`\`\`
{{project_structure}}
\`\`\`
`,
  G: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Overview

{{overview}}

## Architecture

### References
| Topic | File |
|-------|------|
| {{topic_1}} | references/{{ref_1}}.md |
| {{topic_2}} | references/{{ref_2}}.md |

### Scripts
| Script | Purpose |
|--------|---------|
| scripts/{{script_1}} | {{purpose_1}} |
| scripts/{{script_2}} | {{purpose_2}} |

### Subagents
| Agent | Role |
|-------|------|
| agents/{{agent_1}}.md | {{role_1}} |

## Lifecycle

1. **Intake** — Classify user request
2. **Plan** — Break into steps
3. **Generate** — Create all artifacts
4. **Validate** — Run quality checks
5. **Export** — Package for delivery
`,
};

// ---------------------------------------------------------------------------
// Skill Forge command — interactive webview wizard
// ---------------------------------------------------------------------------

/**
 * ClawdContext: Create Skill with Skill Forge
 *
 * Opens an interactive webview panel with an 8-step wizard for building
 * production-grade AI agent skills based on the 7 Archetype system.
 */
export async function openSkillForge(): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'clawdcontextSkillForge',
    'Skill Forge Studio',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  panel.webview.html = getSkillForgeHtml();

  panel.webview.onDidReceiveMessage(async (msg: {
    command: string;
    archetype?: string;
    name?: string;
    description?: string;
    triggers?: string;
  }) => {
    switch (msg.command) {
      case 'generate':
        await generateSkillFiles(msg.archetype ?? 'A', msg.name ?? 'my-skill', msg.description ?? '', msg.triggers ?? '');
        break;
      case 'openDocs':
        vscode.env.openExternal(vscode.Uri.parse('https://clawdcontext.com/en/skill-forge'));
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// File Generator — creates skill directory and files in workspace
// ---------------------------------------------------------------------------

async function generateSkillFiles(archetypeId: string, name: string, description: string, triggers: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    vscode.window.showErrorMessage('Open a workspace first to generate skill files.');
    return;
  }

  const root = folders[0].uri;
  const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const skillDir = vscode.Uri.joinPath(root, '.clawdcontext', 'skills', sanitizedName);

  // Build template content
  const template = SKILL_TEMPLATES[archetypeId] ?? SKILL_TEMPLATES['A'];
  const title = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const filled = template
    .replace(/\{\{name\}\}/g, sanitizedName)
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{description\}\}/g, description || 'TODO: describe this skill')
    .replace(/\{\{triggers\}\}/g, triggers || 'TODO: add trigger phrases')
    .replace(/\{\{[a-z_0-9]+\}\}/g, 'TODO');

  // Create SKILL.md
  const skillMdUri = vscode.Uri.joinPath(skillDir, 'SKILL.md');
  await vscode.workspace.fs.writeFile(skillMdUri, Buffer.from(filled, 'utf-8'));

  // Create subdirectories based on archetype
  const arch = ARCHETYPES.find(a => a.id === archetypeId);
  if (arch) {
    const needs = getSubdirectories(archetypeId);
    for (const dir of needs) {
      const dirUri = vscode.Uri.joinPath(skillDir, dir);
      const readmeUri = vscode.Uri.joinPath(dirUri, '.gitkeep');
      await vscode.workspace.fs.writeFile(readmeUri, Buffer.from('', 'utf-8'));
    }
  }

  // Open the generated SKILL.md
  const doc = await vscode.workspace.openTextDocument(skillMdUri);
  await vscode.window.showTextDocument(doc);

  vscode.window.showInformationMessage(
    `Skill "${sanitizedName}" created at .clawdcontext/skills/${sanitizedName}/`,
  );
}

function getSubdirectories(archetypeId: string): string[] {
  switch (archetypeId) {
    case 'B': return ['templates'];
    case 'C': return ['references'];
    case 'D': return ['scripts'];
    case 'E': return [];
    case 'F': return ['scripts'];
    case 'G': return ['references', 'scripts', 'agents'];
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Webview HTML — Skill Forge Studio wizard
// ---------------------------------------------------------------------------

function getSkillForgeHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Skill Forge Studio</title>
<style>
  :root {
    --bg: #0f172a; --bg2: #1e293b; --bg3: #334155;
    --fg: #e2e8f0; --fg2: #94a3b8; --fg3: #64748b;
    --accent: #e53935; --accent2: #f4511e; --success: #059669;
    --radius: 12px; --font: system-ui, -apple-system, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--font); background: var(--bg); color: var(--fg); padding: 24px; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 20px; font-weight: 600; margin-bottom: 12px; color: var(--fg); }
  h3 { font-size: 15px; font-weight: 600; color: var(--fg2); margin-bottom: 8px; }
  .sub { color: var(--fg2); margin-bottom: 24px; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
  .header-icon { font-size: 32px; }

  /* Steps indicator */
  .steps { display: flex; gap: 8px; margin-bottom: 32px; }
  .step-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--bg3); transition: all 0.3s; }
  .step-dot.active { background: var(--accent); transform: scale(1.3); }
  .step-dot.done { background: var(--success); }

  /* Cards */
  .card { background: var(--bg2); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
  .card:hover { border-color: rgba(255,255,255,0.12); }

  /* Archetype grid */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .arch-card { background: var(--bg2); border: 2px solid transparent; border-radius: var(--radius); padding: 16px; cursor: pointer; transition: all 0.2s; }
  .arch-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-2px); }
  .arch-card.selected { border-color: var(--accent); background: rgba(229,57,53,0.05); }
  .arch-icon { font-size: 24px; margin-bottom: 8px; }
  .arch-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
  .arch-tier { font-size: 11px; color: var(--fg3); text-transform: uppercase; letter-spacing: 0.05em; }
  .arch-desc { font-size: 12px; color: var(--fg2); margin-top: 8px; line-height: 1.5; }
  .arch-example { font-size: 11px; color: var(--fg3); font-family: 'JetBrains Mono', monospace; margin-top: 6px; }

  /* Inputs */
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 13px; font-weight: 500; color: var(--fg2); margin-bottom: 6px; }
  .field input, .field textarea {
    width: 100%; padding: 10px 14px; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; background: var(--bg); color: var(--fg); font-size: 14px;
    font-family: var(--font); outline: none; transition: border-color 0.2s;
  }
  .field input:focus, .field textarea:focus { border-color: var(--accent); }
  .field textarea { min-height: 80px; resize: vertical; }

  /* Buttons */
  .btn { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
  .btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; }
  .btn-primary:hover { transform: translateY(-1px); filter: brightness(1.1); }
  .btn-secondary { background: var(--bg3); color: var(--fg); }
  .btn-secondary:hover { background: rgba(255,255,255,0.15); }
  .btn-group { display: flex; gap: 12px; margin-top: 24px; }

  /* Preview */
  .preview { background: var(--bg); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 16px; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; color: var(--fg2); max-height: 300px; overflow-y: auto; }

  /* Tier badge */
  .tier { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .tier-1 { background: rgba(120,140,93,0.2); color: #788c5d; }
  .tier-2 { background: rgba(45,139,139,0.2); color: #2d8b8b; }
  .tier-3 { background: rgba(212,160,60,0.2); color: #d4a03c; }
  .tier-4 { background: rgba(217,119,87,0.2); color: #d97757; }
  .tier-5 { background: rgba(192,57,43,0.2); color: #c0392b; }

  /* Hidden sections */
  .hidden { display: none; }

  /* Structure preview */
  .structure { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--fg3); padding: 8px 0; }
</style>
</head>
<body>

<div class="header">
  <span class="header-icon">◆</span>
  <div>
    <h1>Skill Forge Studio</h1>
    <p class="sub">Build production-grade AI agent skills in your workspace</p>
  </div>
</div>

<div class="steps" id="steps">
  <div class="step-dot active" data-step="0"></div>
  <div class="step-dot" data-step="1"></div>
  <div class="step-dot" data-step="2"></div>
</div>

<!-- Step 0: Choose Archetype -->
<div id="step0">
  <h2>Choose an Archetype</h2>
  <p class="sub" style="margin-bottom:16px">Every skill maps to one of 7 architectural patterns. Pick the one that fits your idea.</p>

  <div class="grid" id="archGrid">
${ARCHETYPES.map(a => `
    <div class="arch-card" data-id="${a.id}" onclick="selectArchetype('${a.id}')">
      <div class="arch-icon" style="color:${a.color}">${a.icon}</div>
      <div class="arch-name">${a.name}</div>
      <div class="arch-tier"><span class="tier tier-${a.tier.charAt(0)}">Tier ${a.tier}</span></div>
      <div class="arch-desc">${a.desc}</div>
      <div class="arch-example">${a.example}</div>
      <div class="structure">${a.structure}</div>
    </div>
`).join('')}
  </div>

  <div class="btn-group">
    <button class="btn btn-secondary" onclick="openDocs()">📖 Documentation</button>
    <button class="btn btn-primary" id="nextBtn0" onclick="nextStep(1)" disabled>Next →</button>
  </div>
</div>

<!-- Step 1: Configure -->
<div id="step1" class="hidden">
  <h2>Configure Your Skill</h2>
  <p class="sub" style="margin-bottom:16px">Fill in the details for your <strong id="selectedArchName"></strong> skill.</p>

  <div class="card">
    <div class="field">
      <label for="skillName">Skill Name (kebab-case)</label>
      <input type="text" id="skillName" placeholder="e.g. security-hardening" oninput="updatePreview()" />
    </div>
    <div class="field">
      <label for="skillDesc">Description</label>
      <textarea id="skillDesc" placeholder="What does this skill enable the agent to do?" oninput="updatePreview()"></textarea>
    </div>
    <div class="field">
      <label for="skillTriggers">Trigger Phrases</label>
      <input type="text" id="skillTriggers" placeholder="e.g. harden, secure, audit security" oninput="updatePreview()" />
    </div>
  </div>

  <div class="btn-group">
    <button class="btn btn-secondary" onclick="nextStep(0)">← Back</button>
    <button class="btn btn-primary" onclick="nextStep(2)">Preview →</button>
  </div>
</div>

<!-- Step 2: Preview & Generate -->
<div id="step2" class="hidden">
  <h2>Preview & Generate</h2>
  <p class="sub" style="margin-bottom:16px">Review the SKILL.md that will be generated, then create it in your workspace.</p>

  <div class="card">
    <h3>Generated SKILL.md</h3>
    <div class="preview" id="skillPreview"></div>
  </div>

  <div class="card">
    <h3>Files Created</h3>
    <div class="structure" id="fileList"></div>
  </div>

  <div class="btn-group">
    <button class="btn btn-secondary" onclick="nextStep(1)">← Back</button>
    <button class="btn btn-primary" onclick="generate()">⚡ Generate Skill</button>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();
  let selectedArchetype = null;

  function selectArchetype(id) {
    selectedArchetype = id;
    document.querySelectorAll('.arch-card').forEach(c => c.classList.remove('selected'));
    document.querySelector('[data-id="' + id + '"]').classList.add('selected');
    document.getElementById('nextBtn0').disabled = false;
    document.getElementById('selectedArchName').textContent = document.querySelector('[data-id="' + id + '"] .arch-name').textContent;
  }

  function nextStep(n) {
    [0,1,2].forEach(i => {
      document.getElementById('step' + i).classList.toggle('hidden', i !== n);
      const dot = document.querySelector('.step-dot[data-step="' + i + '"]');
      dot.classList.toggle('active', i === n);
      dot.classList.toggle('done', i < n);
    });
    if (n === 2) updatePreview();
  }

  function updatePreview() {
    const name = document.getElementById('skillName').value || 'my-skill';
    const desc = document.getElementById('skillDesc').value || 'TODO';
    const triggers = document.getElementById('skillTriggers').value || 'TODO';
    const title = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const archTemplates = ${JSON.stringify(SKILL_TEMPLATES)};
    let tmpl = archTemplates[selectedArchetype] || archTemplates['A'];
    tmpl = tmpl.replace(/\\{\\{name\\}\\}/g, name)
               .replace(/\\{\\{title\\}\\}/g, title)
               .replace(/\\{\\{description\\}\\}/g, desc)
               .replace(/\\{\\{triggers\\}\\}/g, triggers)
               .replace(/\\{\\{[a-z_0-9]+\\}\\}/g, 'TODO');

    document.getElementById('skillPreview').textContent = tmpl;

    // File list
    const subdirs = {
      B: ['templates/'], C: ['references/'], D: ['scripts/'],
      E: [], F: ['scripts/'], G: ['references/', 'scripts/', 'agents/']
    };
    const dirs = subdirs[selectedArchetype] || [];
    let files = '.clawdcontext/skills/' + name + '/\\n  SKILL.md';
    dirs.forEach(d => { files += '\\n  ' + d; });
    document.getElementById('fileList').textContent = files;
  }

  function generate() {
    vscode.postMessage({
      command: 'generate',
      archetype: selectedArchetype,
      name: document.getElementById('skillName').value || 'my-skill',
      description: document.getElementById('skillDesc').value || '',
      triggers: document.getElementById('skillTriggers').value || ''
    });
  }

  function openDocs() {
    vscode.postMessage({ command: 'openDocs' });
  }
</script>

</body>
</html>`;
}

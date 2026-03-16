/**
 * Skill Forge Studio — Webview HTML Generator.
 *
 * Produces a vanilla HTML/CSS/JS 8-step wizard for the VS Code webview.
 * No React, no CDN dependencies — fully self-contained.
 *
 * Steps: Name(0) → Domain(1) → Output(2) → Probes(3) → Archetype(4)
 *        → Configure(5) → Trigger(6) → Generate(7)
 */

export function getSkillForgeWebviewHtml(mode: 'online' | 'offline'): string {
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
  --accent: #e53935; --accent2: #f4511e; --success: #059669; --warn: #d97706;
  --radius: 12px; --font: system-ui, -apple-system, sans-serif;
  --mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font); background: var(--bg); color: var(--fg); padding: 20px; max-width: 800px; margin: 0 auto; }

/* Header */
.header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.header-icon { font-size: 28px; }
h1 { font-size: 24px; font-weight: 700; }
.sub { color: var(--fg2); font-size: 13px; margin-bottom: 20px; }
.mode-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.mode-online { background: rgba(5,150,105,0.2); color: #059669; }
.mode-offline { background: rgba(100,116,139,0.2); color: #94a3b8; }

/* Steps bar */
.steps-bar { display: flex; gap: 4px; margin-bottom: 24px; align-items: center; }
.step-pip { width: 8px; height: 8px; border-radius: 50%; background: var(--bg3); transition: all 0.3s; flex-shrink: 0; }
.step-pip.active { background: var(--accent); transform: scale(1.4); }
.step-pip.done { background: var(--success); }
.step-label { font-size: 11px; color: var(--fg3); margin-left: 8px; }

/* Sections */
.section { display: none; }
.section.active { display: block; }
h2 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
.section-desc { color: var(--fg2); font-size: 13px; margin-bottom: 16px; line-height: 1.5; }

/* Cards & Grid */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-bottom: 16px; }
.card { background: var(--bg2); border: 2px solid transparent; border-radius: var(--radius); padding: 14px; cursor: pointer; transition: all 0.15s; }
.card:hover { border-color: rgba(255,255,255,0.1); }
.card.selected { border-color: var(--accent); background: rgba(229,57,53,0.06); }
.card-icon { font-size: 22px; margin-bottom: 6px; }
.card-title { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
.card-desc { font-size: 11px; color: var(--fg2); line-height: 1.4; }
.card-examples { font-size: 10px; color: var(--fg3); font-family: var(--mono); margin-top: 4px; }

/* Educate panel */
.educate { background: rgba(229,57,53,0.06); border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: var(--fg2); line-height: 1.5; display: none; }
.educate.visible { display: block; }
.educate strong { color: var(--fg); }

/* Form fields */
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12px; font-weight: 500; color: var(--fg2); margin-bottom: 4px; }
.field input, .field textarea, .field select {
  width: 100%; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; background: var(--bg); color: var(--fg); font-size: 13px;
  font-family: var(--font); outline: none; transition: border-color 0.2s;
}
.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--accent); }
.field textarea { min-height: 60px; resize: vertical; }
.field .hint { font-size: 11px; color: var(--fg3); margin-top: 2px; }

/* Probe cards */
.probe { background: var(--bg2); border-radius: var(--radius); padding: 14px; margin-bottom: 10px; }
.probe-q { font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.probe-hint { font-size: 11px; color: var(--fg3); margin-bottom: 8px; }
.probe-btns { display: flex; gap: 8px; }
.probe-btn { padding: 6px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: var(--bg); color: var(--fg2); font-size: 12px; cursor: pointer; transition: all 0.15s; }
.probe-btn:hover { border-color: rgba(255,255,255,0.2); }
.probe-btn.yes { border-color: var(--success); color: var(--success); background: rgba(5,150,105,0.1); }
.probe-btn.no { border-color: var(--fg3); color: var(--fg3); background: rgba(100,116,139,0.1); }

/* Tier badge */
.tier { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.tier-1 { background: rgba(151,196,89,0.2); color: #97C459; }
.tier-2 { background: rgba(45,139,139,0.2); color: #2d8b8b; }
.tier-3 { background: rgba(239,159,39,0.2); color: #EF9F27; }
.tier-4 { background: rgba(217,119,87,0.2); color: #d97757; }
.tier-5 { background: rgba(192,57,43,0.2); color: #c0392b; }

/* Recommendation badge */
.rec-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background: rgba(5,150,105,0.15); color: #059669; margin-left: 6px; }

/* Archetype card extended */
.arch-structure { font-family: var(--mono); font-size: 10px; color: var(--fg3); margin-top: 4px; }

/* Trigger */
.slider-container { margin-bottom: 14px; }
.slider-container input[type=range] { width: 100%; accent-color: var(--accent); }
.slider-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--fg3); }
.kw-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.kw-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; background: var(--bg3); color: var(--fg2); }

/* File tree */
.file-tree { background: var(--bg); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px; font-family: var(--mono); font-size: 12px; line-height: 1.8; max-height: 280px; overflow-y: auto; }
.file-tree .file { color: var(--fg2); padding-left: 16px; }
.file-tree .dir { color: var(--fg); font-weight: 500; }
.file-tree .meta { color: var(--fg3); font-style: italic; }
.file-tree .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; }
.file-tree .status-core { background: var(--accent); }
.file-tree .status-generated { background: var(--success); }
.file-tree .status-meta { background: var(--fg3); }
.file-tree .status-scaffold { background: var(--warn); }

/* Token budget */
.token-bar { height: 6px; border-radius: 3px; background: var(--bg3); margin: 8px 0; overflow: hidden; }
.token-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.token-label { font-size: 11px; color: var(--fg3); }

/* Progress overlay */
.progress { background: var(--bg2); border-radius: var(--radius); padding: 20px; text-align: center; margin-bottom: 16px; display: none; }
.progress.visible { display: block; }
.progress .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--bg3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 8px; }
@keyframes spin { to { transform: rotate(360deg); } }
.progress-msg { font-size: 13px; color: var(--fg2); }

/* Buttons */
.btn { padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; }
.btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
.btn-secondary { background: var(--bg3); color: var(--fg); }
.btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
.btn-success { background: var(--success); color: white; }
.btn-group { display: flex; gap: 10px; margin-top: 20px; }

/* AI status */
.ai-status { background: var(--bg2); border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.ai-dot { width: 8px; height: 8px; border-radius: 50%; }
.ai-dot.on { background: var(--success); }
.ai-dot.off { background: var(--fg3); }

/* Warnings */
.warnings { margin-top: 12px; }
.warning-item { background: rgba(217,119,0,0.1); border-left: 3px solid var(--warn); padding: 8px 12px; border-radius: 0 6px 6px 0; font-size: 12px; color: var(--fg2); margin-bottom: 6px; }

/* Generated result */
.result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.result-badges { display: flex; gap: 8px; }
.result-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }

</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <span class="header-icon">◆</span>
  <div>
    <h1>Skill Forge Studio</h1>
  </div>
</div>
<div class="sub">
  Build production-grade Claude skills
  <span class="mode-badge ${mode === 'online' ? 'mode-online' : 'mode-offline'}" id="modeBadge">
    ${mode === 'online' ? '● Online' : '○ Offline'}
  </span>
</div>

<!-- AI Status -->
<div class="ai-status" id="aiStatus">
  <div class="ai-dot off" id="aiDot"></div>
  <span id="aiLabel">Checking AI...</span>
</div>

<!-- Steps bar -->
<div class="steps-bar" id="stepsBar">
  <div class="step-pip active" data-step="0"></div>
  <div class="step-pip" data-step="1"></div>
  <div class="step-pip" data-step="2"></div>
  <div class="step-pip" data-step="3"></div>
  <div class="step-pip" data-step="4"></div>
  <div class="step-pip" data-step="5"></div>
  <div class="step-pip" data-step="6"></div>
  <div class="step-pip" data-step="7"></div>
  <span class="step-label" id="stepLabel">Step 1 of 8 — Name</span>
</div>

<!-- ═══════════════ Step 0: Name ═══════════════ -->
<div class="section active" id="step0">
  <h2>Name Your Skill</h2>
  <div class="section-desc">Choose a short, kebab-case name for your skill. This becomes the folder name.</div>
  <div class="field">
    <label for="skillName">Skill Name</label>
    <input type="text" id="skillName" placeholder="e.g. security-hardening" pattern="[a-z0-9-]+" />
    <div class="hint">Lowercase letters, numbers, hyphens only</div>
  </div>
  <div class="field">
    <label for="skillDesc">Description</label>
    <textarea id="skillDesc" placeholder="What does this skill enable the agent to do?" rows="2"></textarea>
  </div>
  <div class="btn-group">
    <button class="btn btn-primary" onclick="goStep(1)" id="nextBtn0">Next →</button>
  </div>
</div>

<!-- ═══════════════ Step 1: Domain ═══════════════ -->
<div class="section" id="step1">
  <h2>Choose Domain</h2>
  <div class="section-desc">What area does your skill specialize in?</div>
  <div class="grid" id="domainGrid"></div>
  <div class="educate" id="domainEducate"></div>
  <div class="btn-group">
    <button class="btn btn-secondary" onclick="goStep(0)">← Back</button>
    <button class="btn btn-primary" onclick="goStep(2)" id="nextBtn1" disabled>Next →</button>
  </div>
</div>

<!-- ═══════════════ Step 2: Output Type ═══════════════ -->
<div class="section" id="step2">
  <h2>Output Type</h2>
  <div class="section-desc">What does your skill produce?</div>
  <div class="grid" id="outputGrid"></div>
  <div class="educate" id="outputEducate"></div>
  <div class="btn-group">
    <button class="btn btn-secondary" onclick="goStep(1)">← Back</button>
    <button class="btn btn-primary" onclick="goStep(3)" id="nextBtn2" disabled>Next →</button>
  </div>
</div>

<!-- ═══════════════ Step 3: Complexity Probes ═══════════════ -->
<div class="section" id="step3">
  <h2>Complexity Probes</h2>
  <div class="section-desc">Answer these questions to determine your skill's complexity tier.</div>
  <div id="probeList"></div>
  <div style="margin-top:12px">
    <span class="tier" id="tierBadge">Tier 1 — Minimal</span>
    <span style="font-size:11px;color:var(--fg3);margin-left:8px" id="tierEducate"></span>
  </div>
  <div class="btn-group">
    <button class="btn btn-secondary" onclick="goStep(2)">← Back</button>
    <button class="btn btn-primary" onclick="goStep(4)">Next →</button>
  </div>
</div>

<!-- ═══════════════ Step 4: Archetype ═══════════════ -->
<div class="section" id="step4">
  <h2>Choose Archetype</h2>
  <div class="section-desc">Select the architectural pattern for your skill. Recommendations are based on your probes.</div>
  <div class="grid" id="archGrid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"></div>
  <div class="educate" id="archEducate"></div>
  <div class="btn-group">
    <button class="btn btn-secondary" onclick="goStep(3)">← Back</button>
    <button class="btn btn-primary" onclick="goStep(5)" id="nextBtn4" disabled>Next →</button>
  </div>
</div>

<!-- ═══════════════ Step 5: Deep Configuration ═══════════════ -->
<div class="section" id="step5">
  <h2>Configure</h2>
  <div class="section-desc" id="configDesc">Fill in the details for your archetype.</div>
  <div id="configFields"></div>
  <div class="btn-group">
    <button class="btn btn-secondary" onclick="goStep(4)">← Back</button>
    <button class="btn btn-primary" onclick="goStep(6)">Next →</button>
  </div>
</div>

<!-- ═══════════════ Step 6: Trigger Design ═══════════════ -->
<div class="section" id="step6">
  <h2>Trigger Design</h2>
  <div class="section-desc">Define when and how aggressively your skill activates.</div>
  <div class="grid" id="triggerGrid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));"></div>
  <div class="educate" id="triggerEducate"></div>
  <div class="slider-container" style="margin-top:16px">
    <label style="font-size:12px;color:var(--fg2)">Pushiness: <strong id="pushValue">50</strong>%</label>
    <input type="range" id="pushSlider" min="0" max="100" value="50" oninput="S.pushiness=+this.value;$('pushValue').textContent=this.value" />
    <div class="slider-labels"><span>Conservative</span><span>Aggressive</span></div>
  </div>
  <div class="field">
    <label for="kwPositive">Positive Keywords (comma-separated)</label>
    <input type="text" id="kwPositive" placeholder="e.g. security, harden, audit, protect" />
  </div>
  <div class="field">
    <label for="kwNegative">Negative Keywords (comma-separated)</label>
    <input type="text" id="kwNegative" placeholder="e.g. ignore, skip, basic" />
  </div>
  <div class="btn-group">
    <button class="btn btn-secondary" onclick="goStep(5)">← Back</button>
    <button class="btn btn-primary" onclick="goStep(7)">Generate →</button>
  </div>
</div>

<!-- ═══════════════ Step 7: Generate & Review ═══════════════ -->
<div class="section" id="step7">
  <h2>Generate & Review</h2>
  <div class="section-desc">Review the file tree, then generate your skill.</div>

  <!-- File tree preview -->
  <div style="margin-bottom:16px">
    <h3 style="font-size:14px;font-weight:600;margin-bottom:8px">File Tree Preview</h3>
    <div class="file-tree" id="fileTree"></div>
    <div class="token-bar"><div class="token-fill" id="tokenFill" style="width:0%;background:var(--success)"></div></div>
    <div class="token-label" id="tokenLabel">Estimated: 0 tokens</div>
  </div>

  <!-- Progress -->
  <div class="progress" id="genProgress">
    <div class="spinner"></div>
    <div class="progress-msg" id="genMsg">Generating skill files...</div>
  </div>

  <!-- Result (hidden until generated) -->
  <div id="genResult" style="display:none">
    <div class="result-header">
      <h3 style="font-size:14px;font-weight:600">Generated Files</h3>
      <div class="result-badges">
        <span class="result-badge" id="resultAiBadge" style="background:rgba(5,150,105,0.15);color:#059669">AI</span>
        <span class="result-badge" id="resultTokenBadge" style="background:rgba(239,159,39,0.15);color:#EF9F27">0 tokens</span>
      </div>
    </div>
    <div class="file-tree" id="resultTree" style="max-height:400px"></div>
    <div class="warnings" id="resultWarnings"></div>
  </div>

  <div class="btn-group">
    <button class="btn btn-secondary" onclick="goStep(6)">← Back</button>
    <button class="btn btn-primary" onclick="doGenerate()" id="genBtn">⚡ Generate</button>
    <button class="btn btn-success" onclick="writeToWorkspace()" id="writeBtn" style="display:none">📁 Write to Workspace</button>
  </div>
</div>

<script>
// ─── Bootstrap ──────────────────────────────────────────────
const vscode = acquireVsCodeApi();
const $ = id => document.getElementById(id);
const STEP_NAMES = ['Name','Domain','Output','Probes','Archetype','Configure','Trigger','Generate'];
let currentStep = 0;

// ─── State ──────────────────────────────────────────────────
const S = {
  name: '', description: '', domain: '', outputType: '', archetype: '',
  probes: { needsScripts:null, needsRefs:null, needsAssets:null, needsValidation:null, needsMultiEnv:null },
  tier: 1,
  triggerStrategy: 'taskIntent', pushiness: 50,
  positiveKw: [], negativeKw: [],
  // Deep config
  templateNames: [], variantNames: [], operations: [], scriptLanguage: 'python',
  subagents: [], environments: [], hasEvalHarness: false, hasCatchAll: false,
  hasSharedUtils: false, phase1Output: 'philosophy', phase2Medium: 'html',
  scaffoldType: 'react', bundleFormat: 'html',
  sections: [],
  // Results
  generatedFiles: null, aiPowered: false,
};
let mode = '${mode}';
let aiStatus = { available: false, source: 'none', provider: '', model: '', label: 'Checking...' };
let recommendations = [];

// ─── Data ───────────────────────────────────────────────────
const DOMAINS = [
  { id:'document', label:'Document', icon:'📄', desc:'docx, pdf, pptx, xlsx', educate:'Your skill will specialize in document creation and manipulation. The agent will optimize for format fidelity, layout, and professional output.' },
  { id:'creative', label:'Creative', icon:'🎨', desc:'Art, design, animation', educate:'Your skill will focus on creative expression. The agent will use two-phase thinking: concept first, then execution.' },
  { id:'developer', label:'Developer', icon:'🛠', desc:'MCP, APIs, scaffolds', educate:'Your skill will target developer workflows. The agent will generate working code, configs, and toolchain integration.' },
  { id:'enterprise', label:'Enterprise', icon:'🏢', desc:'Comms, brand, workflows', educate:'Your skill will follow enterprise standards. The agent will maintain brand voice, approval workflows, and compliance.' },
  { id:'knowledge', label:'Knowledge', icon:'🧠', desc:'Product info, reference', educate:'Your skill will serve as a knowledge base. The agent will provide accurate, sourced answers from structured reference data.' },
  { id:'meta', label:'Meta', icon:'⚙️', desc:'Skill creation, evals', educate:'A skill that creates or evaluates other skills. Meta-level tooling for the skill ecosystem itself.' },
];

const OUTPUTS = [
  { id:'files', label:'Files', icon:'📁', desc:'.docx, .pdf, .xlsx, .pptx', educate:'The agent will produce downloadable files. Best paired with Scripts (A4) or Full Lifecycle (A7) archetypes.' },
  { id:'code', label:'Code', icon:'💻', desc:'.py, .ts, .js, .sh', educate:'The agent will generate executable code. Best with Developer domain and Script Library (A4) or Scaffold Pipeline (A6).' },
  { id:'text', label:'Text', icon:'📝', desc:'Formatted conversations', educate:'The agent will produce structured text output. Works well with Solo Markdown (A1) or Dispatcher (A2).' },
  { id:'visual', label:'Visual', icon:'🖼', desc:'.png, .gif, .html, .svg', educate:'The agent will create visual artifacts. Best with Two-Phase Creative (A5) for concept-first design.' },
  { id:'hybrid', label:'Hybrid', icon:'🔀', desc:'Multiple output types', educate:'The agent will mix output types. Consider Full Lifecycle (A7) to handle the complexity.' },
];

const ARCHETYPES = {
  A1:{ id:'A1', name:'Solo Markdown', icon:'✦', color:'#97C459', tiers:[1,2], desc:'Single SKILL.md — pure instructions.', structure:['SKILL.md'] },
  A2:{ id:'A2', name:'Dispatcher + Templates', icon:'⎔', color:'#2d8b8b', tiers:[1,2], desc:'Tiny router delegating to template files.', structure:['SKILL.md','examples/'] },
  A3:{ id:'A3', name:'Routing Hub + References', icon:'◈', color:'#EF9F27', tiers:[3,4], desc:'Hub routes to deep reference docs.', structure:['SKILL.md','references/'] },
  A4:{ id:'A4', name:'Scripts Library', icon:'⚙', color:'#d97757', tiers:[3,4], desc:'SKILL.md + executable scripts.', structure:['SKILL.md','scripts/'] },
  A5:{ id:'A5', name:'Two-Phase Creative', icon:'◉', color:'#FF375F', tiers:[3], desc:'Philosophy first, then code/visuals.', structure:['SKILL.md','templates/'] },
  A6:{ id:'A6', name:'Scaffold Pipeline', icon:'▥', color:'#6a9bcc', tiers:[3], desc:'Shell scripts scaffold projects.', structure:['SKILL.md','scripts/'] },
  A7:{ id:'A7', name:'Full Lifecycle', icon:'◆', color:'#c0392b', tiers:[4,5], desc:'Multi-env, subagents, eval harnesses.', structure:['SKILL.md','agents/','scripts/','references/','evals/'] },
};

const PROBES = [
  { id:'needsScripts', q:'Does your skill need executable scripts?', hint:'Validation, processing, conversion' },
  { id:'needsRefs', q:'Does your skill need reference docs beyond SKILL.md?', hint:'Language-specific guides, API refs' },
  { id:'needsAssets', q:'Does your skill need bundled assets?', hint:'Templates, fonts, images, components' },
  { id:'needsValidation', q:'Does your skill need output validation?', hint:'Schema checks, visual QA, formula verification' },
  { id:'needsMultiEnv', q:'Does your skill need multi-environment support?', hint:'CLI + Web + IDE extensions' },
];

const TRIGGERS = [
  { id:'fileTypeFirst', label:'File type first', push:80, educate:'Activates on specific file types. Aggressive.' },
  { id:'taskIntent', label:'Task + intent', push:50, educate:'Activates on task descriptions. Balanced.' },
  { id:'selfCorrection', label:'Self-correction', push:95, educate:'Forces consultation mid-response. Very aggressive.' },
  { id:'operationEnum', label:'Operation enum', push:75, educate:'Lists specific handled operations. Clear boundaries.' },
  { id:'domainBlanket', label:'Domain blanket', push:35, educate:'Covers entire domain loosely. Conservative.' },
  { id:'complexityGated', label:'Complexity-gated', push:60, educate:'Only for sufficiently complex tasks.' },
];

const TIER_META = {
  1:{ label:'Minimal', color:'#97C459' },
  2:{ label:'Low', color:'#2d8b8b' },
  3:{ label:'Medium', color:'#EF9F27' },
  4:{ label:'High', color:'#d97757' },
  5:{ label:'Very High', color:'#c0392b' },
};

// ─── Init ───────────────────────────────────────────────────
function init() {
  renderDomainGrid();
  renderOutputGrid();
  renderProbeList();
  renderArchGrid();
  renderTriggerGrid();
  // Request initial status from extension
  vscode.postMessage({ command: 'sfs:check' });
}

// ─── Navigation ─────────────────────────────────────────────
function goStep(n) {
  if (n < 0 || n > 7) return;
  // Validate before advancing
  if (n > currentStep) {
    if (currentStep === 0 && !S.name) {
      S.name = $('skillName').value.replace(/[^a-z0-9-]/g, '-').toLowerCase();
      S.description = $('skillDesc').value;
      if (!S.name) return;
    }
    if (currentStep === 1 && !S.domain) return;
    if (currentStep === 2 && !S.outputType) return;
    if (currentStep === 4 && !S.archetype) return;
  }
  // Collect data before leaving current step
  if (currentStep === 0) {
    S.name = $('skillName').value.replace(/[^a-z0-9-]/g, '-').toLowerCase();
    S.description = $('skillDesc').value;
  }
  if (currentStep === 5) collectConfig();
  if (currentStep === 6) collectTrigger();

  currentStep = n;
  document.querySelectorAll('.section').forEach((el,i) => el.classList.toggle('active', i === n));
  document.querySelectorAll('.step-pip').forEach((el,i) => {
    el.classList.toggle('active', i === n);
    el.classList.toggle('done', i < n);
  });
  $('stepLabel').textContent = 'Step ' + (n+1) + ' of 8 — ' + STEP_NAMES[n];

  // On entering Step 4, compute recommendations
  if (n === 4) computeRecommendations();
  // On entering Step 5, render config fields
  if (n === 5) renderConfigFields();
  // On entering Step 7, render file tree preview
  if (n === 7) renderFileTree();
}

// ─── Domain Grid ────────────────────────────────────────────
function renderDomainGrid() {
  $('domainGrid').innerHTML = DOMAINS.map(d =>
    '<div class="card" data-id="'+d.id+'" onclick="selectDomain(\\''+d.id+'\\')">' +
      '<div class="card-icon">'+d.icon+'</div>' +
      '<div class="card-title">'+d.label+'</div>' +
      '<div class="card-desc">'+d.desc+'</div>' +
    '</div>'
  ).join('');
}
function selectDomain(id) {
  S.domain = id;
  $('domainGrid').querySelectorAll('.card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
  const d = DOMAINS.find(x => x.id === id);
  $('domainEducate').innerHTML = d.educate;
  $('domainEducate').classList.add('visible');
  $('nextBtn1').disabled = false;
}

// ─── Output Grid ────────────────────────────────────────────
function renderOutputGrid() {
  $('outputGrid').innerHTML = OUTPUTS.map(o =>
    '<div class="card" data-id="'+o.id+'" onclick="selectOutput(\\''+o.id+'\\')">' +
      '<div class="card-icon">'+o.icon+'</div>' +
      '<div class="card-title">'+o.label+'</div>' +
      '<div class="card-desc">'+o.desc+'</div>' +
    '</div>'
  ).join('');
}
function selectOutput(id) {
  S.outputType = id;
  $('outputGrid').querySelectorAll('.card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
  const o = OUTPUTS.find(x => x.id === id);
  $('outputEducate').innerHTML = o.educate;
  $('outputEducate').classList.add('visible');
  $('nextBtn2').disabled = false;
}

// ─── Probes List ────────────────────────────────────────────
function renderProbeList() {
  $('probeList').innerHTML = PROBES.map(p =>
    '<div class="probe" id="probe_'+p.id+'">' +
      '<div class="probe-q">'+p.q+'</div>' +
      '<div class="probe-hint">'+p.hint+'</div>' +
      '<div class="probe-btns">' +
        '<button class="probe-btn" data-probe="'+p.id+'" data-val="true" onclick="setProbe(\\''+p.id+'\\',true,this)">Yes</button>' +
        '<button class="probe-btn" data-probe="'+p.id+'" data-val="false" onclick="setProbe(\\''+p.id+'\\',false,this)">No</button>' +
      '</div>' +
    '</div>'
  ).join('');
}
function setProbe(id, val, btn) {
  S.probes[id] = val;
  const parent = btn.parentNode;
  parent.querySelectorAll('.probe-btn').forEach(b => {
    b.classList.remove('yes','no');
    if (b.dataset.val === 'true' && val) b.classList.add('yes');
    if (b.dataset.val === 'false' && !val) b.classList.add('no');
  });
  updateTier();
}
function updateTier() {
  const yes = Object.values(S.probes).filter(v => v === true).length;
  S.tier = Math.max(1, Math.min(5, yes || 1));
  const t = TIER_META[S.tier];
  $('tierBadge').className = 'tier tier-' + S.tier;
  $('tierBadge').textContent = 'Tier ' + S.tier + ' — ' + t.label;
}

// ─── Archetype Grid ─────────────────────────────────────────
function renderArchGrid() {
  const ids = ['A1','A2','A3','A4','A5','A6','A7'];
  $('archGrid').innerHTML = ids.map(id => {
    const a = ARCHETYPES[id];
    return '<div class="card" data-id="'+id+'" onclick="selectArch(\\''+id+'\\')">' +
      '<div class="card-icon" style="color:'+a.color+'">'+a.icon+'</div>' +
      '<div class="card-title">'+a.name+' <span class="rec-badge" id="rec_'+id+'" style="display:none"></span></div>' +
      '<div class="card-desc">'+a.desc+'</div>' +
      '<div class="arch-structure">'+a.structure.join(' · ')+'</div>' +
    '</div>';
  }).join('');
}
function selectArch(id) {
  S.archetype = id;
  $('archGrid').querySelectorAll('.card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
  const a = ARCHETYPES[id];
  $('archEducate').innerHTML = '<strong>'+a.name+'</strong>: '+a.desc;
  $('archEducate').classList.add('visible');
  $('nextBtn4').disabled = false;
}
function computeRecommendations() {
  // Simple local recommendation: match probe answers to archetype suitability
  const p = S.probes;
  const scores = {};
  scores.A1 = (p.needsScripts===false?2:0) + (p.needsRefs===false?2:0) + (p.needsAssets===false?1:0);
  scores.A2 = (p.needsAssets===true?2:0) + (p.needsScripts===false?1:0);
  scores.A3 = (p.needsRefs===true?3:0) + (p.needsScripts===false?1:0);
  scores.A4 = (p.needsScripts===true?3:0) + (p.needsValidation===true?1:0);
  scores.A5 = (S.domain==='creative'?3:0) + (S.outputType==='visual'?2:0);
  scores.A6 = (S.outputType==='code'?2:0) + (p.needsScripts===true?1:0);
  scores.A7 = (p.needsMultiEnv===true?2:0) + (p.needsValidation===true?2:0) + (p.needsScripts===true?1:0) + (p.needsRefs===true?1:0);

  recommendations = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,3);

  // Update badges
  Object.keys(ARCHETYPES).forEach(id => { $('rec_'+id).style.display = 'none'; });
  recommendations.forEach(([id, score], i) => {
    if (score > 0) {
      const badge = $('rec_'+id);
      badge.style.display = 'inline';
      badge.textContent = i === 0 ? '★ Best' : '#'+(i+1);
    }
  });

  // If SFS backend is online, also try server-side recommendation
  if (mode === 'online') {
    vscode.postMessage({ command: 'sfs:recommend', domain: S.domain, outputType: S.outputType, probes: S.probes });
  }
}

// ─── Trigger Grid ───────────────────────────────────────────
function renderTriggerGrid() {
  $('triggerGrid').innerHTML = TRIGGERS.map(t =>
    '<div class="card" data-id="'+t.id+'" onclick="selectTrigger(\\''+t.id+'\\')">' +
      '<div class="card-title">'+t.label+'</div>' +
      '<div class="card-desc">'+t.educate+'</div>' +
    '</div>'
  ).join('');
  // Default selection
  selectTrigger('taskIntent');
}
function selectTrigger(id) {
  S.triggerStrategy = id;
  $('triggerGrid').querySelectorAll('.card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
  const t = TRIGGERS.find(x => x.id === id);
  $('triggerEducate').innerHTML = t.educate;
  $('triggerEducate').classList.add('visible');
  $('pushSlider').value = t.push;
  $('pushValue').textContent = t.push;
  S.pushiness = t.push;
}

// ─── Deep Configuration (Step 5) ───────────────────────────
function renderConfigFields() {
  const a = S.archetype;
  let html = '';
  $('configDesc').textContent = 'Configure your ' + ARCHETYPES[a].name + ' skill.';

  // Common: sections
  html += field('Sections (comma-separated)', 'cfgSections', 'e.g. Core Philosophy, Anti-Patterns, Examples', 'text');

  if (a === 'A2') {
    html += field('Template Names (comma-separated)', 'cfgTemplates', 'e.g. report, memo, brief', 'text');
    html += checkbox('cfgCatchAll', 'Include catch-all fallback template');
  }
  if (a === 'A3' || a === 'A7') {
    html += field('Reference Variants (comma-separated)', 'cfgVariants', 'e.g. python, typescript, go', 'text');
    if (a === 'A3') html += field('Routing Criteria', 'cfgRouting', 'e.g. Language of the user\\'s project', 'text');
  }
  if (a === 'A4' || a === 'A6' || a === 'A7') {
    html += field('Operations / Scripts (comma-separated)', 'cfgOps', 'e.g. convert, validate, export', 'text');
    html += selectField('Script Language', 'cfgLang', [['python','Python'],['javascript','JavaScript'],['shell','Shell']]);
    if (a === 'A4') html += checkbox('cfgSharedUtils', 'Include shared utility module');
  }
  if (a === 'A5') {
    html += selectField('Phase 1 Output', 'cfgPhase1', [['philosophy','Philosophy'],['spec','Specification'],['algorithm','Algorithm']]);
    html += selectField('Phase 2 Medium', 'cfgPhase2', [['html','HTML'],['p5','p5.js'],['canvas','Canvas'],['svg','SVG']]);
  }
  if (a === 'A6') {
    html += field('Scaffold Type', 'cfgScaffold', 'e.g. react, nextjs, express', 'text');
    html += selectField('Bundle Format', 'cfgBundle', [['html','HTML'],['zip','ZIP'],['tar','TAR']]);
  }
  if (a === 'A7') {
    html += field('Subagents (comma-separated)', 'cfgAgents', 'e.g. reviewer, validator, formatter', 'text');
    html += field('Environments (comma-separated)', 'cfgEnvs', 'e.g. cli, web, vscode', 'text');
    html += checkbox('cfgEval', 'Include eval harness');
  }

  $('configFields').innerHTML = html;
}
function collectConfig() {
  const v = id => { const el = $(id); return el ? el.value : ''; };
  const list = id => v(id).split(',').map(s=>s.trim()).filter(Boolean);
  const chk = id => { const el = $(id); return el ? el.checked : false; };

  S.sections = list('cfgSections');
  S.templateNames = list('cfgTemplates');
  S.hasCatchAll = chk('cfgCatchAll');
  S.variantNames = list('cfgVariants');
  S.operations = list('cfgOps');
  S.scriptLanguage = v('cfgLang') || 'python';
  S.hasSharedUtils = chk('cfgSharedUtils');
  S.phase1Output = v('cfgPhase1') || 'philosophy';
  S.phase2Medium = v('cfgPhase2') || 'html';
  S.scaffoldType = v('cfgScaffold') || 'react';
  S.bundleFormat = v('cfgBundle') || 'html';
  S.subagents = list('cfgAgents');
  S.environments = list('cfgEnvs');
  S.hasEvalHarness = chk('cfgEval');
}
function collectTrigger() {
  S.positiveKw = ($('kwPositive').value || '').split(',').map(s=>s.trim()).filter(Boolean);
  S.negativeKw = ($('kwNegative').value || '').split(',').map(s=>s.trim()).filter(Boolean);
}
function field(label, id, placeholder, type) {
  return '<div class="field"><label for="'+id+'">'+label+'</label><input type="'+type+'" id="'+id+'" placeholder="'+placeholder+'" /></div>';
}
function selectField(label, id, options) {
  const opts = options.map(([val,text]) => '<option value="'+val+'">'+text+'</option>').join('');
  return '<div class="field"><label for="'+id+'">'+label+'</label><select id="'+id+'">'+opts+'</select></div>';
}
function checkbox(id, label) {
  return '<div class="field" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="'+id+'" style="width:auto" /><label for="'+id+'" style="margin:0">'+label+'</label></div>';
}

// ─── File Tree Preview ──────────────────────────────────────
function computeExpectedFiles() {
  const a = S.archetype;
  const ext = {python:'py',javascript:'js',shell:'sh'}[S.scriptLanguage] || 'py';
  const files = [];
  const slug = s => s.replace(/[^a-z0-9-]/gi,'-').toLowerCase();

  files.push({ path:'SKILL.md', status:'core', desc:'Main skill instructions' });

  if (a === 'A2') {
    (S.templateNames.length ? S.templateNames : ['example']).forEach(t =>
      files.push({ path:'examples/'+slug(t)+'.md', status:'generated', desc:'Template: '+t }));
    if (S.hasCatchAll) files.push({ path:'examples/catch-all.md', status:'generated', desc:'Fallback template' });
  }
  if (a === 'A3' || a === 'A7') {
    (S.variantNames.length ? S.variantNames : ['default']).forEach(v =>
      files.push({ path:'references/'+slug(v)+'.md', status:'generated', desc:'Reference: '+v }));
  }
  if (a === 'A4' || a === 'A6' || a === 'A7') {
    (S.operations.length ? S.operations : ['main']).forEach(op =>
      files.push({ path:'scripts/'+slug(op)+'.'+ext, status:'generated', desc:'Script: '+op }));
    if (a === 'A6') {
      files.push({ path:'scripts/init.sh', status:'generated', desc:'Scaffold init' });
      files.push({ path:'scripts/bundle.sh', status:'generated', desc:'Build + bundle' });
    }
    if (S.hasSharedUtils) files.push({ path:'scripts/utils.'+ext, status:'generated', desc:'Shared utilities' });
  }
  if (a === 'A5') {
    files.push({ path:'templates/base.'+({html:'html',p5:'js',canvas:'js',svg:'svg'}[S.phase2Medium]||'html'), status:'generated', desc:'Phase 2 template' });
  }
  if (a === 'A7') {
    (S.subagents.length ? S.subagents : []).forEach(ag =>
      files.push({ path:'agents/'+slug(ag)+'.md', status:'generated', desc:'Subagent: '+ag }));
  }
  if (S.hasEvalHarness || a === 'A7') {
    files.push({ path:'evals/evals.json', status:'generated', desc:'Eval assertions' });
    files.push({ path:'evals/quality-rubric.md', status:'generated', desc:'Quality rubric' });
    if (S.operations.length || ['A4','A6','A7'].includes(a)) {
      files.push({ path:'evals/validate.'+ext, status:'generated', desc:'Validation script' });
    }
  }

  // Scaffold empty dirs
  const expectedDirs = new Set();
  if (a==='A2') expectedDirs.add('examples');
  if (a==='A3'||a==='A7') expectedDirs.add('references');
  if (a==='A4'||a==='A6'||a==='A7') expectedDirs.add('scripts');
  if (a==='A5') expectedDirs.add('templates');
  if (a==='A7') { expectedDirs.add('agents'); expectedDirs.add('assets'); }
  const existingDirs = new Set(files.filter(f=>f.path.includes('/')).map(f=>f.path.split('/')[0]));
  for (const d of expectedDirs) {
    if (!existingDirs.has(d)) files.push({ path:d+'/.gitkeep', status:'scaffold', desc:'Empty directory' });
  }

  files.push({ path:'README.md', status:'meta', desc:'Project readme' });
  files.push({ path:'.gitignore', status:'meta', desc:'Git ignore rules' });

  return files;
}
function renderFileTree() {
  const files = computeExpectedFiles();
  const html = files.map(f => {
    const isDir = f.path.endsWith('.gitkeep');
    const cls = isDir ? 'meta' : 'file';
    return '<div class="'+cls+'"><span class="status-dot status-'+f.status+'"></span>'+f.path+' <span style="color:var(--fg3);font-size:10px">— '+f.desc+'</span></div>';
  }).join('');
  $('fileTree').innerHTML = '<div class="dir">'+S.name+'/</div>' + html;

  // Token estimate (rough: 4 chars ≈ 1 token, ~50 lines/file avg)
  const estTokens = files.length * 200;
  const maxTokens = [0,2000,5000,15000,30000,50000][S.tier] || 15000;
  const pct = Math.min(100, Math.round((estTokens/maxTokens)*100));
  $('tokenFill').style.width = pct+'%';
  $('tokenFill').style.background = pct > 80 ? 'var(--warn)' : pct > 95 ? 'var(--accent)' : 'var(--success)';
  $('tokenLabel').textContent = 'Estimate: ~'+estTokens+' tokens ('+pct+'% of tier '+S.tier+' budget)';
}

// ─── Generate ───────────────────────────────────────────────
function buildConfig() {
  return {
    name: S.name,
    description: S.description || S.name,
    domain: S.domain,
    output_type: S.outputType,
    archetype: S.archetype,
    tier: S.tier,
    instruction_style: 'imperative',
    trigger_strategy: S.triggerStrategy,
    pushiness: S.pushiness,
    positive_keywords: S.positiveKw,
    negative_keywords: S.negativeKw,
    template_names: S.templateNames,
    has_catch_all: S.hasCatchAll,
    variant_names: S.variantNames,
    routing_criteria: '',
    operations: S.operations,
    script_language: S.scriptLanguage,
    has_shared_utils: S.hasSharedUtils,
    phase1_output: S.phase1Output,
    phase2_medium: S.phase2Medium,
    scaffold_type: S.scaffoldType,
    bundle_format: S.bundleFormat,
    subagents: S.subagents,
    has_eval_harness: S.hasEvalHarness,
    environments: S.environments,
    shared_code_modules: [],
    context_mode: 'inline',
    hooks_before: '',
    hooks_after: '',
    allowed_tools: [],
    sections: S.sections,
  };
}
function doGenerate() {
  collectConfig();
  collectTrigger();
  $('genProgress').classList.add('visible');
  $('genBtn').disabled = true;
  $('genResult').style.display = 'none';
  $('writeBtn').style.display = 'none';

  vscode.postMessage({ command: 'sfs:generate', config: buildConfig() });
}

// ─── Write to Workspace ─────────────────────────────────────
function writeToWorkspace() {
  if (!S.generatedFiles) return;
  vscode.postMessage({
    command: 'workspace:write',
    name: S.name,
    files: S.generatedFiles,
  });
}

// ─── Messages from Extension ────────────────────────────────
window.addEventListener('message', ev => {
  const msg = ev.data;
  switch (msg.command) {
    case 'mode':
      mode = msg.online ? 'online' : 'offline';
      $('modeBadge').className = 'mode-badge ' + (msg.online ? 'mode-online' : 'mode-offline');
      $('modeBadge').textContent = msg.online ? '● Online' : '○ Offline';
      aiStatus = msg.ai || aiStatus;
      $('aiDot').className = 'ai-dot ' + (aiStatus.available ? 'on' : 'off');
      $('aiLabel').textContent = aiStatus.label;
      break;

    case 'sfs:recommend:result':
      if (msg.data && msg.data.recommendations) {
        // Update badges from server recommendations
        msg.data.recommendations.slice(0,3).forEach((r, i) => {
          const badge = $('rec_'+r.archetype);
          if (badge) {
            badge.style.display = 'inline';
            badge.textContent = i === 0 ? '★ Best' : '#'+(i+1);
          }
        });
      }
      break;

    case 'sfs:generate:result':
      $('genProgress').classList.remove('visible');
      $('genBtn').disabled = false;
      if (msg.success) {
        S.generatedFiles = msg.data.files;
        S.aiPowered = msg.data.ai_powered;
        showResult(msg.data);
      } else {
        $('genMsg').textContent = 'Error: ' + (msg.error || 'Generation failed');
      }
      break;

    case 'workspace:write:done':
      $('writeBtn').textContent = '✅ Written!';
      $('writeBtn').disabled = true;
      break;

    case 'progress':
      $('genMsg').textContent = msg.message || 'Generating...';
      break;
  }
});

function showResult(data) {
  $('genResult').style.display = 'block';
  $('writeBtn').style.display = '';

  // Badges
  $('resultAiBadge').textContent = data.ai_powered ? '🤖 AI-Generated' : '📄 Template';
  $('resultAiBadge').style.background = data.ai_powered ? 'rgba(5,150,105,0.15)' : 'rgba(100,116,139,0.15)';
  $('resultAiBadge').style.color = data.ai_powered ? '#059669' : '#94a3b8';
  $('resultTokenBadge').textContent = data.token_budget_used + ' tokens';

  // File tree
  $('resultTree').innerHTML = data.files.map(f =>
    '<div class="file" style="cursor:pointer" onclick="previewFile(\\''+f.path.replace(/'/g,"\\\\'")+'\\')"><span class="status-dot status-generated"></span>'+f.path+' <span style="color:var(--fg3);font-size:10px">('+f.estimated_lines+' lines)</span></div>'
  ).join('');

  // Warnings
  if (data.validation_warnings && data.validation_warnings.length) {
    $('resultWarnings').innerHTML = data.validation_warnings.map(w =>
      '<div class="warning-item">⚠ '+w+'</div>'
    ).join('');
  } else {
    $('resultWarnings').innerHTML = '';
  }
}

function previewFile(path) {
  if (!S.generatedFiles) return;
  const f = S.generatedFiles.find(x => x.path === path);
  if (f) {
    vscode.postMessage({ command: 'workspace:preview', path: f.path, content: f.content, language: f.language });
  }
}

// ─── Boot ───────────────────────────────────────────────────
init();
</script>
</body>
</html>`;
}
